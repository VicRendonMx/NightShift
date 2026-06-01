"""
02_eventbrite.py
────────────────
Populate the `event` table from the Eventbrite API v3.

Categories queried:
  103 — Music
  105 — Performing Arts  (comedy, theatre)
  110 — Food & Drink     (bar events)

Only events whose Eventbrite venue can be matched to an existing row in our
`venue` table are inserted.  Matching strategy (in order):
  1. Exact google_place_id match  (not available from Eventbrite, skip)
  2. Case-insensitive address prefix match  (formattedAddress starts-with)
  3. Fuzzy venue-name match using trigram similarity (pg_trgm optional —
     falls back to ILIKE if the extension is not installed)

Returns {"inserted": int, "updated": int, "skipped": int}
"""

import logging
import os
import re
import sys
from datetime import datetime, timezone

import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import EVENTBRITE_API_KEY
from db import get_connection, upsert_event

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "eventbrite.log")
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)

# ─────────────────────────────────────────
# Constants
# ─────────────────────────────────────────

BASE_URL    = "https://www.eventbriteapi.com/v3/events/search/"
CATEGORIES  = ["103", "105", "110"]
PAGE_SIZE   = 50

# Maps Eventbrite category id → our event_type
CATEGORY_EVENT_TYPE: dict[str, str] = {
    "103": "live_music",
    "105": "comedy",
    "110": "club_night",
}

AUTH_HEADERS = {"Authorization": f"Bearer {EVENTBRITE_API_KEY}"}


# ─────────────────────────────────────────
# Venue matching helpers
# ─────────────────────────────────────────

def _normalise_address(addr: str | None) -> str:
    """Lowercase, strip extra whitespace, remove punctuation for loose matching."""
    if not addr:
        return ""
    return re.sub(r"[^\w\s]", "", addr.lower()).strip()


def find_venue_id(conn, eb_venue: dict) -> str | None:
    """
    Try to find our internal venue UUID for the given Eventbrite venue object.

    eb_venue keys of interest:
        name          str
        address.localized_address_display  str  e.g. "270 Adelaide St W, Toronto, ON M5H 1X6"
    """
    if not eb_venue:
        return None

    eb_name    = (eb_venue.get("name") or "").strip()
    eb_address = (eb_venue.get("address") or {}).get("localized_address_display", "")

    with conn.cursor() as cur:
        # --- Strategy 1: exact name match (case-insensitive) ---
        if eb_name:
            cur.execute(
                "SELECT id FROM venue WHERE LOWER(name) = LOWER(%s) LIMIT 1;",
                (eb_name,),
            )
            row = cur.fetchone()
            if row:
                return str(row["id"])

        # --- Strategy 2: address prefix match ---
        # Extract the street portion (everything before the first comma).
        street = eb_address.split(",")[0].strip() if eb_address else ""
        if street:
            cur.execute(
                "SELECT id FROM venue WHERE LOWER(address) LIKE LOWER(%s) LIMIT 1;",
                (f"{street}%",),
            )
            row = cur.fetchone()
            if row:
                return str(row["id"])

        # --- Strategy 3: trigram similarity (pg_trgm) with ILIKE fallback ---
        if eb_name:
            try:
                cur.execute(
                    """
                    SELECT id FROM venue
                    WHERE similarity(LOWER(name), LOWER(%s)) > 0.5
                    ORDER BY similarity(LOWER(name), LOWER(%s)) DESC
                    LIMIT 1;
                    """,
                    (eb_name, eb_name),
                )
            except Exception:
                # pg_trgm not installed — fall back to ILIKE wildcard
                conn.rollback()
                cur.execute(
                    "SELECT id FROM venue WHERE name ILIKE %s LIMIT 1;",
                    (f"%{eb_name}%",),
                )
            row = cur.fetchone()
            if row:
                return str(row["id"])

    return None


# ─────────────────────────────────────────
# Ticket price parsing
# ─────────────────────────────────────────

def parse_prices(ticket_availability: dict | None) -> tuple[float | None, float | None]:
    """
    Return (min_price, max_price) in CAD dollars from the ticket_availability block.
    Eventbrite returns minor units (cents) in some endpoints — we normalise both.
    """
    if not ticket_availability:
        return None, None

    min_price = ticket_availability.get("minimum_ticket_price")
    max_price = ticket_availability.get("maximum_ticket_price")

    def to_float(price_obj) -> float | None:
        if not price_obj:
            return None
        # major_value is a string like "25.00"; value is in minor units (int cents)
        major = price_obj.get("major_value")
        if major is not None:
            try:
                return float(major)
            except (TypeError, ValueError):
                pass
        minor = price_obj.get("value")
        if minor is not None:
            try:
                return int(minor) / 100.0
            except (TypeError, ValueError):
                pass
        return None

    return to_float(min_price), to_float(max_price)


# ─────────────────────────────────────────
# Datetime parsing
# ─────────────────────────────────────────

def parse_dt(dt_str: str | None) -> datetime | None:
    """Parse an ISO-8601 string from Eventbrite into a timezone-aware datetime."""
    if not dt_str:
        return None
    # Eventbrite returns e.g. "2026-06-14T22:00:00Z" or "2026-06-14T22:00:00"
    dt_str = dt_str.rstrip("Z")
    try:
        dt = datetime.fromisoformat(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


# ─────────────────────────────────────────
# Pagination
# ─────────────────────────────────────────

def fetch_events_page(category: str, continuation: str | None,
                      retries: int = 3) -> dict:
    """Fetch one page of events for the given category. Retries up to 3 times on timeout."""
    params: dict = {
        "location.address":    "Toronto, ON",
        "location.within":     "15km",
        "categories":          category,
        "expand":              "venue,ticket_availability",
        "page_size":           PAGE_SIZE,
    }
    if continuation:
        params["continuation"] = continuation

    last_exc = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(BASE_URL, headers=AUTH_HEADERS, params=params, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except (requests.Timeout, requests.ConnectionError) as exc:
            last_exc = exc
            wait = attempt * 5
            log.warning("Attempt %d/%d timed out — retrying in %ds…", attempt, retries, wait)
            time.sleep(wait)
        except requests.HTTPError:
            raise

    raise last_exc


# ─────────────────────────────────────────
# Per-event processing
# ─────────────────────────────────────────

def process_event(conn, eb_event: dict, category: str) -> str:
    """
    Match the Eventbrite event to a venue and upsert into the event table.
    Returns 'inserted', 'updated', or 'skipped'.
    Caller is responsible for committing.
    """
    eb_id = str(eb_event.get("id", ""))
    name  = (eb_event.get("name") or {}).get("text", "").strip()

    if not eb_id or not name:
        log.info("SKIP  eb_id=%s  reason=missing_id_or_name", eb_id)
        return "skipped"

    eb_venue = eb_event.get("venue") or {}
    venue_id = find_venue_id(conn, eb_venue)

    if not venue_id:
        log.info(
            "SKIP  eb_id=%s  name=%.60s  reason=venue_not_in_db  eb_venue=%s",
            eb_id, name, eb_venue.get("name", ""),
        )
        return "skipped"

    # Check whether this external_id already exists to report insert vs update
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM event WHERE external_id = %s AND external_source = 'eventbrite';",
            (eb_id,),
        )
        existing = cur.fetchone()

    start_time = parse_dt((eb_event.get("start") or {}).get("utc"))
    end_time   = parse_dt((eb_event.get("end")   or {}).get("utc"))

    if not start_time:
        log.info("SKIP  eb_id=%s  reason=no_start_time", eb_id)
        return "skipped"

    price_min, price_max = parse_prices(eb_event.get("ticket_availability"))
    is_free = bool(eb_event.get("is_free")) or (price_min == 0 and price_max == 0)

    description = (eb_event.get("description") or {}).get("text") or \
                  (eb_event.get("summary") or "").strip() or None

    ticket_url = eb_event.get("url")

    event_dict = {
        "venue_id":         venue_id,
        "title":            name,
        "description":      description,
        "event_type":       CATEGORY_EVENT_TYPE.get(category),
        "start_time":       start_time,
        "end_time":         end_time,
        "is_free":          is_free,
        "ticket_price_min": price_min,
        "ticket_price_max": price_max,
        "ticket_url":       ticket_url,
        "external_id":      eb_id,
        "external_source":  "eventbrite",
        "is_cancelled":     eb_event.get("status") == "canceled",
    }

    upsert_event(conn, event_dict)
    action = "updated" if existing else "inserted"
    log.info("%s  eb_id=%s  venue_id=%s  name=%.60s", action.upper(), eb_id, venue_id, name)
    return action


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

def run() -> dict:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}

    conn = get_connection()
    try:
        for category in CATEGORIES:
            log.info("─── Fetching category %s ───", category)
            continuation: str | None = None
            page_num = 0

            while True:
                page_num += 1
                log.info("Category %s  page %d  continuation=%s",
                         category, page_num, continuation or "START")

                try:
                    data = fetch_events_page(category, continuation)
                except requests.HTTPError as exc:
                    log.error("HTTP error fetching category %s page %d: %s",
                              category, page_num, exc)
                    break

                events = data.get("events", [])
                log.info("  Got %d events", len(events))

                for eb_event in events:
                    try:
                        action = process_event(conn, eb_event, category)
                        counts[action] += 1
                        conn.commit()
                    except Exception:
                        conn.rollback()
                        log.exception(
                            "ERROR processing eb_id=%s — rolled back.",
                            eb_event.get("id", "unknown"),
                        )
                        counts["skipped"] += 1

                # Pagination
                pagination = data.get("pagination", {})
                continuation = pagination.get("continuation")
                has_more = pagination.get("has_more_items", False)

                if not has_more or not continuation:
                    log.info("Category %s exhausted after %d pages.", category, page_num)
                    break

        log.info(
            "Done. inserted=%d  updated=%d  skipped=%d",
            counts["inserted"], counts["updated"], counts["skipped"],
        )
    except Exception:
        conn.rollback()
        log.exception("Fatal error — transaction rolled back.")
        raise
    finally:
        conn.close()

    return counts


if __name__ == "__main__":
    run()
