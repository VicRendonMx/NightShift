"""
03_songkick.py
──────────────
Populate event, performer, and event_performer from the Songkick API.

Metro area: Toronto (id 17835)
Endpoint:   GET https://api.songkick.com/api/3.0/metro_areas/17835/calendar.json

For each event in the calendar:
  1. Toronto-bounds check on the Songkick venue's lat/lng (or geocoded address).
  2. Find or create a matching venue row in our database.
  3. Upsert every performing artist as a performer row.
  4. Upsert the event row (external_source = 'songkick').
  5. Upsert the event_performer junction row for each artist.

Returns {"inserted": int, "updated": int, "skipped": int}
"""

import logging
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import SONGKICK_API_KEY
from db import get_connection, upsert_event, upsert_performer
from utils.toronto_bounds import is_in_toronto

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "songkick.log")
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

METRO_ID   = 17835
BASE_URL   = f"https://api.songkick.com/api/3.0/metro_areas/{METRO_ID}/calendar.json"
PAGE_SIZE  = 50
REQUEST_DELAY = 0.25   # seconds between API calls

# Songkick genre field lives inside the artist object's identifier list —
# we fall back to the event type string if unavailable.
SK_TYPE_MAP: dict[str, str] = {
    "Concert":   "live_music",
    "Festival":  "festival",
}


# ─────────────────────────────────────────
# Pagination helper
# ─────────────────────────────────────────

def fetch_page(page: int) -> dict:
    """Fetch one page of the Toronto metro calendar. Returns raw response dict."""
    resp = requests.get(
        BASE_URL,
        params={
            "apikey":   SONGKICK_API_KEY,
            "page":     page,
            "per_page": PAGE_SIZE,
        },
        timeout=20,
    )
    resp.raise_for_status()
    time.sleep(REQUEST_DELAY)
    return resp.json()


# ─────────────────────────────────────────
# Venue matching
# ─────────────────────────────────────────

def find_venue_id(conn, sk_venue: dict) -> str | None:
    """
    Locate our internal venue UUID for the given Songkick venue object.

    Matching order:
      1. Exact name match (case-insensitive)
      2. Street-portion address prefix
      3. Trigram similarity > 0.5  (ILIKE fallback if pg_trgm absent)
    """
    name    = (sk_venue.get("displayName") or "").strip()
    address = (sk_venue.get("street") or "").strip()

    with conn.cursor() as cur:
        # Strategy 1 — exact name
        if name:
            cur.execute(
                "SELECT id FROM venue WHERE LOWER(name) = LOWER(%s) LIMIT 1;",
                (name,),
            )
            row = cur.fetchone()
            if row:
                return str(row["id"])

        # Strategy 2 — street address prefix
        if address:
            cur.execute(
                "SELECT id FROM venue WHERE LOWER(address) LIKE LOWER(%s) LIMIT 1;",
                (f"{address}%",),
            )
            row = cur.fetchone()
            if row:
                return str(row["id"])

        # Strategy 3 — trigram / ILIKE fallback
        if name:
            try:
                cur.execute(
                    """
                    SELECT id FROM venue
                    WHERE similarity(LOWER(name), LOWER(%s)) > 0.5
                    ORDER BY similarity(LOWER(name), LOWER(%s)) DESC
                    LIMIT 1;
                    """,
                    (name, name),
                )
            except Exception:
                conn.rollback()
                cur.execute(
                    "SELECT id FROM venue WHERE name ILIKE %s LIMIT 1;",
                    (f"%{name}%",),
                )
            row = cur.fetchone()
            if row:
                return str(row["id"])

    return None


# ─────────────────────────────────────────
# Datetime parsing
# ─────────────────────────────────────────

def parse_dt(date_str: str | None, time_str: str | None) -> datetime | None:
    """
    Combine a Songkick date string ('YYYY-MM-DD') and optional time string
    ('HH:MM:SS') into a UTC-aware datetime.

    Songkick times are in the venue's local timezone but the API does not
    return an offset — we store them tagged as UTC and note this in the logs.
    A full timezone-aware conversion would require a separate geocoding step
    that is out of scope for this pipeline.
    """
    if not date_str:
        return None
    raw = date_str
    if time_str:
        raw = f"{date_str}T{time_str}"
    try:
        dt = datetime.fromisoformat(raw)
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# ─────────────────────────────────────────
# event_performer upsert
# ─────────────────────────────────────────

EVENT_PERFORMER_SQL = """
    INSERT INTO event_performer (event_id, performer_id, role, set_time)
    VALUES (%s, %s, %s, %s)
    ON CONFLICT (event_id, performer_id) DO UPDATE SET
        role     = EXCLUDED.role,
        set_time = EXCLUDED.set_time;
"""


def upsert_event_performer(conn, event_id: str, performer_id: str,
                           role: str = "headliner", set_time: str | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(EVENT_PERFORMER_SQL, (event_id, performer_id, role, set_time))


# ─────────────────────────────────────────
# Toronto bounds check for a Songkick venue
# ─────────────────────────────────────────

def venue_in_toronto(sk_venue: dict) -> bool:
    """
    Return True if the Songkick venue's coordinates or city name indicate Toronto.

    Songkick venues carry lat/lng directly when geocoded; fall back to
    city.displayName check when coordinates are absent.
    """
    lat = sk_venue.get("lat")
    lng = sk_venue.get("lng")

    if lat is not None and lng is not None:
        try:
            return is_in_toronto(float(lat), float(lng))
        except (TypeError, ValueError):
            pass

    # Fallback: city name check
    city = (sk_venue.get("city") or {}).get("displayName", "")
    metro = (sk_venue.get("metroArea") or {}).get("displayName", "")
    text = f"{city} {metro}".lower()
    return "toronto" in text


# ─────────────────────────────────────────
# Per-event processing
# ─────────────────────────────────────────

def process_event(conn, sk_event: dict) -> str:
    """
    Process a single Songkick event object.
    Returns 'inserted', 'updated', or 'skipped'.
    Caller must commit.
    """
    sk_id   = str(sk_event.get("id", ""))
    title   = (sk_event.get("displayName") or "").strip()
    sk_type = sk_event.get("type", "Concert")

    if not sk_id or not title:
        log.info("SKIP  sk_id=%s  reason=missing_id_or_title", sk_id)
        return "skipped"

    # Songkick events may have multiple venue entries; take the first.
    sk_venue = (sk_event.get("venue") or {})
    location = sk_event.get("location") or {}

    # Toronto bounds check
    if not venue_in_toronto(sk_venue):
        log.info("SKIP  sk_id=%s  name=%.60s  reason=outside_toronto", sk_id, title)
        return "skipped"

    # Match to our venue table
    venue_id = find_venue_id(conn, sk_venue)
    if not venue_id:
        log.info(
            "SKIP  sk_id=%s  name=%.60s  reason=venue_not_in_db  sk_venue=%s",
            sk_id, title, sk_venue.get("displayName", ""),
        )
        return "skipped"

    # ── Dates ───────────────────────────────────────────────────────────────
    start_obj = sk_event.get("start") or {}
    end_obj   = sk_event.get("end")   or {}

    start_time = parse_dt(start_obj.get("date"), start_obj.get("time"))
    end_time   = parse_dt(end_obj.get("date"),   end_obj.get("time"))

    if not start_time:
        log.info("SKIP  sk_id=%s  reason=no_start_time", sk_id)
        return "skipped"

    # ── Ticket info ──────────────────────────────────────────────────────────
    price_min: float | None = None
    price_max: float | None = None
    ticket_url: str | None = None

    for offer in sk_event.get("offers", []):
        if offer.get("type") == "Standard":
            try:
                price_min = float(offer["price"])
                price_max = float(offer["price"])
            except (KeyError, TypeError, ValueError):
                pass
            ticket_url = offer.get("uri")
            break

    # ── Performers ───────────────────────────────────────────────────────────
    performances = sk_event.get("performance") or []

    # ── Check for existing event ─────────────────────────────────────────────
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM event WHERE external_id = %s AND external_source = 'songkick';",
            (sk_id,),
        )
        existing = cur.fetchone()

    event_dict = {
        "venue_id":        venue_id,
        "title":           title,
        "description":     None,
        "event_type":      SK_TYPE_MAP.get(sk_type, "live_music"),
        "start_time":      start_time,
        "end_time":        end_time,
        "is_free":         price_min == 0,
        "ticket_price_min":price_min,
        "ticket_price_max":price_max,
        "ticket_url":      ticket_url,
        "external_id":     sk_id,
        "external_source": "songkick",
        "is_cancelled":    sk_event.get("status", "").lower() == "cancelled",
    }

    event_id = upsert_event(conn, event_dict)
    action   = "updated" if existing else "inserted"
    log.info("%s  sk_id=%s  event_id=%s  name=%.60s",
             action.upper(), sk_id, event_id, title)

    # ── Upsert performers and link to event ──────────────────────────────────
    for perf in performances:
        artist = perf.get("artist") or {}
        artist_name = (artist.get("displayName") or "").strip()
        if not artist_name:
            continue

        # Determine billing role
        billing = (perf.get("billing") or "headline").lower()
        role = "headliner" if "headline" in billing else "support"

        # Extract genre from artist identifier list when present
        genre: str | None = None
        for identifier in artist.get("identifier", []):
            if identifier.get("eventsCount", 0) > 0:
                # Songkick doesn't expose genre directly; use any tagged mbid as proxy
                pass
        # genre remains None — enrichment is left for a future pass

        performer_dict = {
            "name":          artist_name,
            "performer_type":"artist",
            "genre":          genre,
            "songkick_id":    str(artist["id"]) if artist.get("id") else None,
            "is_local":       False,
        }

        performer_id = upsert_performer(conn, performer_dict)
        upsert_event_performer(conn, event_id, performer_id, role=role)

        log.info(
            "  PERFORMER  performer_id=%s  name=%s  role=%s",
            performer_id, artist_name, role,
        )

    return action


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

def run() -> dict:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}

    conn = get_connection()
    try:
        page      = 1
        total_entries = None

        while True:
            log.info("Fetching page %d…", page)

            try:
                data = fetch_page(page)
            except requests.HTTPError as exc:
                log.error("HTTP error on page %d: %s", page, exc)
                break

            results_page = (
                data.get("resultsPage") or {}
            )
            status = results_page.get("status", "")
            if status != "ok":
                log.error("Songkick API returned status=%s on page %d", status, page)
                break

            results   = results_page.get("results") or {}
            events    = results.get("event") or []

            if total_entries is None:
                total_entries = results_page.get("totalEntries", 0)
                log.info("Total entries reported by API: %d", total_entries)

            log.info("Page %d: %d events", page, len(events))

            if not events:
                log.info("No more events — pagination complete.")
                break

            for sk_event in events:
                try:
                    action = process_event(conn, sk_event)
                    counts[action] += 1
                    conn.commit()
                except Exception:
                    conn.rollback()
                    log.exception(
                        "ERROR processing sk_id=%s — rolled back.",
                        sk_event.get("id", "unknown"),
                    )
                    counts["skipped"] += 1

            # Advance page — stop when we've consumed all reported entries
            per_page      = results_page.get("perPage", PAGE_SIZE)
            pages_fetched = page * per_page
            if total_entries and pages_fetched >= total_entries:
                log.info("All %d entries consumed after %d pages.", total_entries, page)
                break

            page += 1

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
