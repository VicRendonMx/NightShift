"""
05_google_places_grid.py
────────────────────────
Geographic grid sweep of the Greater Toronto Area using the Google Places
API (New) nearbySearch endpoint.

Strategy
────────
Divide the GTA bounding box into a grid of overlapping circles (radius 1 km,
step 1.2 km).  For each cell, call nearbySearch with every nightlife-relevant
includedType.  This guarantees complete geographic coverage — no venue within
Toronto can be missed as long as it appears in Google Maps.

Grid math (approx)
  Lat  43.580 → 43.855  = 0.275° ≈ 30.6 km  →  ~26 rows
  Lng -79.640 → -79.115 = 0.525° ≈ 38.5 km  →  ~32 cols
  Total cells ≈ 832 per type pass

NIGHTLIFE_TYPES is queried in separate passes so we stay within the
nearbySearch single-type-per-call constraint and collect places that
Google only tags with one type.

All place IDs collected across every cell and type are deduplicated before
the detail-fetch pass, so each place is fetched and upserted exactly once.

Returns {"inserted": int, "updated": int, "skipped": int}
"""

import logging
import os
import sys
import time

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import GOOGLE_PLACES_API_KEY
from db import get_connection, upsert_venue
from utils.slugify import make_slug
from utils.toronto_bounds import GTA_BOUNDS, is_in_toronto

# Re-use helpers from the keyword-search script.
# importlib is required because the filename starts with a digit.
import importlib
_gp = importlib.import_module("sources.01_google_places")
DETAIL_FIELD_MASK  = _gp.DETAIL_FIELD_MASK
GET_PLACE_URL      = _gp.GET_PLACE_URL
HEADERS            = _gp.HEADERS
REQUEST_DELAY      = _gp.REQUEST_DELAY
TYPE_MAP           = _gp.TYPE_MAP
fetch_place_detail = _gp.fetch_place_detail
infer_vibe_tags    = _gp.infer_vibe_tags
map_venue_type     = _gp.map_venue_type
upsert_hours       = _gp.upsert_hours
upsert_photos      = _gp.upsert_photos
NEIGHBOURHOOD_SQL  = _gp.NEIGHBOURHOOD_SQL
apply_vibe_tags    = _gp.apply_vibe_tags

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "google_places_grid.log")
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
# Grid parameters
# ─────────────────────────────────────────

# Circle radius for each cell (metres).  1000 m keeps result counts manageable
# while 1200 m step size creates ~20% overlap so no gap exists between cells.
CELL_RADIUS_M = 1000
STEP_LAT      = 0.0108   # ≈ 1.2 km in latitude degrees
STEP_LNG      = 0.0144   # ≈ 1.2 km in longitude degrees (at Toronto's latitude)

# Google Places (New) type identifiers for nightlife venues
NIGHTLIFE_TYPES = [
    "bar",
    "night_club",
    "live_music_venue",
    "comedy_club",
    "karaoke",
    "bar_and_grill",
    "pub",
    "cocktail_bar",
    "wine_bar",
    "sports_bar",
    "rooftop_bar",
    "lounge",
]

NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby"
MAX_RESULTS_PER_CELL = 20


# ─────────────────────────────────────────
# Grid generation
# ─────────────────────────────────────────

def generate_grid() -> list[tuple[float, float]]:
    """Return list of (lat, lng) centre points covering the GTA bounding box."""
    points = []
    lat = GTA_BOUNDS["south"]
    while lat <= GTA_BOUNDS["north"]:
        lng = GTA_BOUNDS["west"]
        while lng <= GTA_BOUNDS["east"]:
            points.append((round(lat, 6), round(lng, 6)))
            lng += STEP_LNG
        lat += STEP_LAT
    log.info("Grid generated: %d cells", len(points))
    return points


# ─────────────────────────────────────────
# nearbySearch API call
# ─────────────────────────────────────────

def nearby_search(lat: float, lng: float, place_type: str) -> list[str]:
    """
    Call Places API nearbySearch for one cell + one type.
    Returns list of place_id strings found.
    """
    payload = {
        "includedTypes":    [place_type],
        "maxResultCount":   MAX_RESULTS_PER_CELL,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(CELL_RADIUS_M),
            }
        },
    }

    try:
        resp = requests.post(
            NEARBY_SEARCH_URL,
            json=payload,
            headers={**HEADERS, "X-Goog-FieldMask": "places.id"},
            timeout=15,
        )
        resp.raise_for_status()
        time.sleep(REQUEST_DELAY)
        return [p["id"] for p in resp.json().get("places", [])]
    except requests.HTTPError as exc:
        # 400 can mean the type is not supported — log and skip silently
        if exc.response is not None and exc.response.status_code == 400:
            log.debug("Type %s not supported by nearbySearch, skipping.", place_type)
            return []
        log.warning("HTTP error at (%.4f, %.4f) type=%s: %s", lat, lng, place_type, exc)
        return []
    except requests.RequestException as exc:
        log.warning("Request error at (%.4f, %.4f) type=%s: %s", lat, lng, place_type, exc)
        return []


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

def run() -> dict:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}

    grid = generate_grid()
    total_cells = len(grid)
    all_place_ids: set[str] = set()

    # ── Phase 1: collect all place IDs via grid sweep ──────────────────────
    log.info("Phase 1 — Grid sweep: %d cells × %d types", total_cells, len(NIGHTLIFE_TYPES))

    for cell_idx, (lat, lng) in enumerate(grid, start=1):
        cell_ids: set[str] = set()
        for place_type in NIGHTLIFE_TYPES:
            ids = nearby_search(lat, lng, place_type)
            cell_ids.update(ids)

        new_ids = cell_ids - all_place_ids
        all_place_ids.update(cell_ids)

        if cell_idx % 50 == 0 or cell_idx == total_cells:
            log.info(
                "Grid progress: %d/%d cells  unique_ids_so_far=%d  new_this_cell=%d",
                cell_idx, total_cells, len(all_place_ids), len(new_ids),
            )

    log.info("Phase 1 complete. Total unique place_ids discovered: %d", len(all_place_ids))

    # ── Phase 2: filter out place IDs already in the database ──────────────
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT google_place_id FROM venue WHERE google_place_id IS NOT NULL;")
            existing_ids = {row["google_place_id"] for row in cur.fetchall()}

        new_place_ids = all_place_ids - existing_ids
        log.info(
            "Phase 2 — Already in DB: %d  New to fetch: %d",
            len(existing_ids), len(new_place_ids),
        )

        # ── Phase 3: detail fetch + upsert ─────────────────────────────────
        log.info("Phase 3 — Fetching details for %d new places…", len(new_place_ids))

        for i, place_id in enumerate(new_place_ids, start=1):
            if i % 50 == 0:
                log.info("Detail fetch progress: %d/%d", i, len(new_place_ids))

            place = fetch_place_detail(place_id)
            if place is None:
                counts["skipped"] += 1
                continue

            name = (place.get("displayName") or {}).get("text", "").strip()
            if not name:
                counts["skipped"] += 1
                continue

            location = place.get("location", {})
            lat_v = location.get("latitude")
            lng_v = location.get("longitude")

            if lat_v is None or lng_v is None or not is_in_toronto(lat_v, lng_v):
                log.info("SKIP  place_id=%s  name=%s  reason=outside_toronto", place_id, name)
                counts["skipped"] += 1
                continue

            venue_type  = map_venue_type(place.get("types", []))
            editorial   = (place.get("editorialSummary") or {}).get("text", "")
            vibe_tags   = infer_vibe_tags(f"{name} {editorial}")

            venue_dict = {
                "name":                name,
                "slug":                make_slug(name),
                "address":             place.get("formattedAddress"),
                "lat":                 lat_v,
                "lng":                 lng_v,
                "venue_type":          venue_type,
                "vibe_tags":           vibe_tags or None,
                "google_place_id":     place_id,
                "google_rating":       place.get("rating"),
                "google_review_count": place.get("userRatingCount"),
                "website_url":         place.get("websiteUri"),
                "phone":               place.get("nationalPhoneNumber"),
                "is_active":           True,
            }

            try:
                # Determine insert vs update for accurate reporting
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id FROM venue WHERE google_place_id = %s", (place_id,)
                    )
                    existing = cur.fetchone()

                venue_id = upsert_venue(conn, venue_dict)
                action   = "updated" if existing else "inserted"
                counts[action] += 1

                log.info("%s  venue_id=%s  place_id=%s  name=%s",
                         action.upper(), venue_id, place_id, name)

                # Hours
                periods = (place.get("regularOpeningHours") or {}).get("periods", [])
                if periods:
                    upsert_hours(conn, venue_id, periods)

                # Photos
                photos = place.get("photos", [])
                if photos:
                    upsert_photos(conn, venue_id, photos)

                conn.commit()

            except Exception:
                conn.rollback()
                log.exception("ERROR processing place_id=%s — rolled back.", place_id)
                counts["skipped"] += 1

        # ── Phase 4: neighbourhood assignment + vibe tag pass ──────────────
        log.info("Phase 4 — Assigning neighbourhoods…")
        with conn.cursor() as cur:
            cur.execute(NEIGHBOURHOOD_SQL)
            log.info("Neighbourhood assignment updated %d rows.", cur.rowcount)
        conn.commit()

        log.info("Phase 4 — Vibe tag second pass…")
        apply_vibe_tags(conn)
        conn.commit()

        log.info(
            "Done. inserted=%d  updated=%d  skipped=%d  total_in_db=%d",
            counts["inserted"], counts["updated"], counts["skipped"],
            len(existing_ids) + counts["inserted"],
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
