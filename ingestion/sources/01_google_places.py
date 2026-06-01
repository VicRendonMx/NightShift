"""
01_google_places.py
───────────────────
Populate venue, hours, and venue_photo from the Google Places API (New).

Pipeline:
  Step 1  — Discovery: searchText for each TORONTO_NIGHTLIFE_SEARCH_TERMS term,
             paginate via nextPageToken, collect unique place_ids.
  Step 2  — Detail fetch: getPlace with the required field mask.
  Step 3  — Toronto filter: drop anything outside the GTA bounding box.
  Step 4  — Type mapping: Google types → our venue_type enum.
  Step 5  — Neighbourhood assignment: nearest-centroid spatial query.
  Step 6  — Hours: parse regularOpeningHours.periods → hours table.
  Step 7  — Photos: first 5 photo references → venue_photo table.
  Step 8  — Vibe tag inference: keyword scan of name + editorialSummary.

Returns {"inserted": int, "updated": int, "skipped": int}
"""

import logging
import os
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import GOOGLE_PLACES_API_KEY, TORONTO_NIGHTLIFE_SEARCH_TERMS
from db import get_connection, upsert_venue
from utils.slugify import make_slug
from utils.toronto_bounds import is_in_toronto

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "google_places.log")
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

SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"
GET_PLACE_URL   = "https://places.googleapis.com/v1/places/{place_id}"
PHOTO_URL       = "https://places.googleapis.com/v1/{name}/media?maxHeightPx=1200&maxWidthPx=1200&key={key}&skipHttpRedirect=true"

DETAIL_FIELD_MASK = (
    "id,displayName,formattedAddress,location,types,"
    "regularOpeningHours,rating,userRatingCount,photos,"
    "websiteUri,nationalPhoneNumber,editorialSummary,priceLevel"
)

# Seconds to wait between API calls — stay well inside the 10 QPS default quota.
REQUEST_DELAY = 0.12

TYPE_MAP: dict[str, str] = {
    "night_club":       "nightclub",
    "bar":              "bar",
    "live_music_venue": "live_music",
    "comedy_club":      "comedy",
    "rooftop_bar":      "rooftop",
}

VIBE_KEYWORD_MAP: dict[str, str] = {
    "rooftop":       "rooftop",
    "patio":         "patio",
    "lgbtq":         "lgbtq friendly",
    "gay":           "lgbtq friendly",
    "latin":         "latin vibes",
    "karaoke":       "karaoke",
    "comedy":        "comedy night",
    "jazz":          "jazz",
    "cocktail":      "craft cocktails",
    "dive":          "dive bar",
    "sports":        "sports bar",
    "live music":    "live music",
    "after hours":   "after hours",
    "bottle service":"bottle service",
}

HEADERS = {
    "Content-Type":  "application/json",
    "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
}


# ─────────────────────────────────────────
# Step 1 — Discovery
# ─────────────────────────────────────────

def discover_place_ids() -> set[str]:
    """Return all unique place_id strings found across all search terms."""
    place_ids: set[str] = set()

    for term in TORONTO_NIGHTLIFE_SEARCH_TERMS:
        log.info("Searching: %s", term)
        page_token: str | None = None

        while True:
            payload: dict = {
                "textQuery": term,
                "locationBias": {
                    "circle": {
                        "center": {"latitude": 43.6532, "longitude": -79.3832},
                        "radius": 30000.0,   # 30 km — captures the full GTA
                    }
                },
                "maxResultCount": 20,
            }
            if page_token:
                payload["pageToken"] = page_token

            resp = requests.post(
                SEARCH_TEXT_URL,
                json=payload,
                headers={**HEADERS, "X-Goog-FieldMask": "places.id,nextPageToken"},
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()

            for place in data.get("places", []):
                place_ids.add(place["id"])

            page_token = data.get("nextPageToken")
            time.sleep(REQUEST_DELAY)

            if not page_token:
                break

        log.info("Running total unique place_ids: %d", len(place_ids))

    log.info("Discovery complete. Total unique place_ids: %d", len(place_ids))
    return place_ids


# ─────────────────────────────────────────
# Step 2 — Detail fetch
# ─────────────────────────────────────────

def fetch_place_detail(place_id: str) -> dict | None:
    """Fetch full place detail for a single place_id. Returns raw API dict or None on error."""
    url = GET_PLACE_URL.format(place_id=place_id)
    try:
        resp = requests.get(
            url,
            headers={**HEADERS, "X-Goog-FieldMask": DETAIL_FIELD_MASK},
            timeout=15,
        )
        resp.raise_for_status()
        time.sleep(REQUEST_DELAY)
        return resp.json()
    except requests.HTTPError as exc:
        log.warning("Detail fetch failed for %s: %s", place_id, exc)
        return None


# ─────────────────────────────────────────
# Step 4 — Type mapping
# ─────────────────────────────────────────

def map_venue_type(types: list[str]) -> str | None:
    """Return the first matching venue_type from TYPE_MAP, or None."""
    for t in types:
        if t in TYPE_MAP:
            return TYPE_MAP[t]
    return None


# ─────────────────────────────────────────
# Step 6 — Hours parsing
# ─────────────────────────────────────────

def _zero_pad(value: int) -> str:
    """Format an integer hour or minute as zero-padded two-digit string."""
    return str(value).zfill(2)


def upsert_hours(conn, venue_id: str, periods: list[dict]) -> None:
    """
    Parse regularOpeningHours.periods and upsert into the hours table.

    Google period schema:
        { "open":  {"day": 0-6, "hour": 0-23, "minute": 0-59},
          "close": {"day": 0-6, "hour": 0-23, "minute": 0-59} }

    Google uses 0=Sunday; our schema uses 0=Monday.
    Conversion: our_day = (google_day - 1) % 7
    """
    DAY_MAP = {0: 6, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5}  # google_day → our_day

    delete_sql = "DELETE FROM hours WHERE venue_id = %s;"
    insert_sql = """
        INSERT INTO hours (venue_id, day_of_week, open_time, close_time, is_closed, is_after_hours)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT DO NOTHING;
    """

    with conn.cursor() as cur:
        cur.execute(delete_sql, (venue_id,))
        for period in periods:
            open_info  = period.get("open", {})
            close_info = period.get("close")

            google_day = open_info.get("day", 0)
            our_day    = DAY_MAP[google_day]

            open_time_str  = f"{_zero_pad(open_info.get('hour', 0))}:{_zero_pad(open_info.get('minute', 0))}:00"
            close_time_str = None
            is_closed      = close_info is None
            is_after_hours = False

            if close_info:
                close_time_str = f"{_zero_pad(close_info.get('hour', 0))}:{_zero_pad(close_info.get('minute', 0))}:00"
                # Crosses midnight when close hour < open hour (e.g. open 22:00, close 02:00)
                is_after_hours = close_info.get("hour", 0) < open_info.get("hour", 0)

            cur.execute(insert_sql, (
                venue_id, our_day, open_time_str, close_time_str, is_closed, is_after_hours,
            ))


# ─────────────────────────────────────────
# Step 7 — Photos
# ─────────────────────────────────────────

def upsert_photos(conn, venue_id: str, photos: list[dict]) -> None:
    """
    Fetch up to 5 photo URLs via the Places Photos API and store in venue_photo.
    First photo is marked is_primary = TRUE.
    Uses ON CONFLICT (url) DO NOTHING for idempotency if a unique index exists,
    otherwise checks existence before inserting.
    """
    insert_sql = """
        INSERT INTO venue_photo (venue_id, url, source, is_primary, sort_order)
        VALUES (%s, %s, 'google', %s, %s)
        ON CONFLICT DO NOTHING;
    """

    with conn.cursor() as cur:
        for idx, photo in enumerate(photos[:5]):
            photo_name = photo.get("name", "")
            if not photo_name:
                continue

            photo_url = PHOTO_URL.format(name=photo_name, key=GOOGLE_PLACES_API_KEY)

            # Resolve the redirect to get the actual CDN URL.
            try:
                r = requests.get(photo_url, timeout=15, allow_redirects=False)
                if r.status_code in (301, 302, 303, 307, 308):
                    resolved_url = r.headers.get("Location", photo_url)
                else:
                    resolved_url = photo_url
                time.sleep(REQUEST_DELAY)
            except requests.RequestException as exc:
                log.warning("Photo fetch failed for venue %s photo %d: %s", venue_id, idx, exc)
                resolved_url = photo_url  # store the API URL as fallback

            cur.execute(insert_sql, (venue_id, resolved_url, idx == 0, idx))


# ─────────────────────────────────────────
# Step 8 — Vibe tag inference
# ─────────────────────────────────────────

def infer_vibe_tags(text: str) -> list[str]:
    """Scan lowercased text for VIBE_KEYWORD_MAP keywords; return deduplicated tag list."""
    lower = text.lower()
    tags: list[str] = []
    seen: set[str] = set()
    for keyword, tag in VIBE_KEYWORD_MAP.items():
        if keyword in lower and tag not in seen:
            tags.append(tag)
            seen.add(tag)
    return tags


def apply_vibe_tags(conn) -> None:
    """
    Second-pass update: for every venue that has no vibe_tags yet, build the tag
    array from the venue name alone (editorial summary was saved at insert time
    inside venue_type/cover_notes — we scan the name as a lightweight proxy).
    """
    select_sql = "SELECT id, name FROM venue WHERE vibe_tags IS NULL OR vibe_tags = '{}';"
    update_sql = "UPDATE venue SET vibe_tags = %s WHERE id = %s;"

    with conn.cursor() as cur:
        cur.execute(select_sql)
        rows = cur.fetchall()
        for row in rows:
            tags = infer_vibe_tags(row["name"])
            if tags:
                cur.execute(update_sql, (tags, row["id"]))


# ─────────────────────────────────────────
# Step 5 — Neighbourhood assignment
# ─────────────────────────────────────────

NEIGHBOURHOOD_SQL = """
    UPDATE venue SET neighbourhood_id = (
        SELECT id FROM neighbourhood
        ORDER BY point(lng, lat) <-> point(venue.lng, venue.lat)
        LIMIT 1
    ) WHERE neighbourhood_id IS NULL;
"""


# ─────────────────────────────────────────
# Main ingestion loop
# ─────────────────────────────────────────

def process_place(conn, place: dict) -> str:
    """
    Insert or update a single place.  Returns 'inserted', 'updated', or 'skipped'.
    Caller must commit.
    """
    place_id = place.get("id", "")
    name     = (place.get("displayName") or {}).get("text", "").strip()

    if not name:
        log.warning("SKIP  place_id=%s  reason=no_name", place_id)
        return "skipped"

    location = place.get("location", {})
    lat = location.get("latitude")
    lng = location.get("longitude")

    # Step 3 — Toronto filter
    if lat is None or lng is None or not is_in_toronto(lat, lng):
        log.info("SKIP  place_id=%s  name=%s  reason=outside_toronto  lat=%s  lng=%s",
                 place_id, name, lat, lng)
        return "skipped"

    # Step 4 — Type mapping
    venue_type = map_venue_type(place.get("types", []))

    # Step 8 setup — collect text for vibe tag inference
    editorial = (place.get("editorialSummary") or {}).get("text", "")
    vibe_tags  = infer_vibe_tags(f"{name} {editorial}")

    venue_dict = {
        "name":               name,
        "slug":               make_slug(name),
        "address":            place.get("formattedAddress"),
        "lat":                lat,
        "lng":                lng,
        "venue_type":         venue_type,
        "vibe_tags":          vibe_tags or None,
        "google_place_id":    place_id,
        "google_rating":      place.get("rating"),
        "google_review_count":place.get("userRatingCount"),
        "website_url":        place.get("websiteUri"),
        "phone":              place.get("nationalPhoneNumber"),
        "is_active":          True,
    }

    # Detect insert vs update before upsert (xmax trick via RETURNING is inside upsert_venue,
    # but we need to check existence here to report the action accurately).
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM venue WHERE google_place_id = %s", (place_id,))
        existing = cur.fetchone()

    venue_id = upsert_venue(conn, venue_dict)
    action   = "updated" if existing else "inserted"

    log.info("%s  venue_id=%s  place_id=%s  name=%s",
             action.upper(), venue_id, place_id, name)

    # Step 6 — Hours
    periods = (place.get("regularOpeningHours") or {}).get("periods", [])
    if periods:
        upsert_hours(conn, venue_id, periods)

    # Step 7 — Photos
    photos = place.get("photos", [])
    if photos:
        upsert_photos(conn, venue_id, photos)

    return action


def run() -> dict:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}

    # Step 1 — Discovery
    place_ids = discover_place_ids()

    conn = get_connection()
    try:
        # Steps 2–7 — per-place processing
        for i, place_id in enumerate(place_ids, start=1):
            log.info("Processing %d/%d  place_id=%s", i, len(place_ids), place_id)

            place = fetch_place_detail(place_id)
            if place is None:
                counts["skipped"] += 1
                continue

            try:
                action = process_place(conn, place)
                counts[action] += 1
                conn.commit()
            except Exception:
                conn.rollback()
                log.exception("ERROR processing place_id=%s — rolled back.", place_id)
                counts["skipped"] += 1

        # Step 5 — Neighbourhood assignment (bulk, after all venues are in)
        log.info("Assigning neighbourhoods to unassigned venues…")
        with conn.cursor() as cur:
            cur.execute(NEIGHBOURHOOD_SQL)
            log.info("Neighbourhood assignment updated %d rows.", cur.rowcount)
        conn.commit()

        # Step 8 — Vibe tag second pass for any venues still missing tags
        log.info("Running vibe tag second pass…")
        apply_vibe_tags(conn)
        conn.commit()

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
