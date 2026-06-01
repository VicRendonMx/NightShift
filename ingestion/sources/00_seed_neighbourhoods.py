"""
00_seed_neighbourhoods.py
─────────────────────────
Seed the `neighbourhood` table from TORONTO_NEIGHBOURHOODS in config.py.
Safe to re-run — uses ON CONFLICT (slug) DO UPDATE.

Returns a dict: {"inserted": int, "updated": int, "skipped": int}
"""

import logging
import os
import sys

# Allow running directly from the sources/ directory or from ingestion/.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import TORONTO_NEIGHBOURHOODS
from db import get_connection

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "neighbourhoods.log")
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
# Hand-written vibe summaries (one per slug)
# ─────────────────────────────────────────

VIBE_SUMMARIES: dict[str, str] = {
    "king-west": (
        "Toronto's densest club strip. King Street West between Bathurst and Spadina "
        "is the epicentre of bottle service, high-energy dance floors, and late-night lineups."
    ),
    "entertainment-district": (
        "Home to the city's biggest venues — Rebel, Coda, Toybox. Best for EDM, "
        "large-capacity shows, and sporting-event overflow."
    ),
    "kensington-market": (
        "Eclectic, indie, anti-mainstream. Dive bars, patio hangs, reggae and world music. "
        "The anti-King-West."
    ),
    "little-italy": (
        "College Street's laid-back Italian corridor. Sidewalk patios, aperitivo culture, "
        "and a creative local crowd. Great for a slow evening that turns into a late one."
    ),
    "ossington": (
        "Toronto's cocktail corridor. Low-key, creative-crowd bars. "
        "Best for first dates and pre-drinks."
    ),
    "leslieville": (
        "East-end chill. Neighbourhood bars, live music, patio culture. "
        "More locals than tourists."
    ),
    "church-wellesley": (
        "The heart of Toronto's LGBTQ+ scene. Inclusive, high-energy, welcoming to all."
    ),
    "distillery-district": (
        "Cobblestone streets, upscale cocktail bars, artisanal everything. Date-night central."
    ),
    "annex": (
        "Student-meets-intellectual on Bloor Street West. Cozy pubs, indie concert venues, "
        "and late-night spots that stay real no matter how trendy the rest of the city gets."
    ),
    "yorkville": (
        "Toronto's upscale playground. Rooftop lounges, bottle-service hotspots, and "
        "cocktail bars dressed in designer lighting. For when you want to look the part."
    ),
    "scarborough": (
        "The east end's underrated nightlife belt. Diverse food-and-drink scene, "
        "Caribbean and South Asian influences, and a local community energy you won't find downtown."
    ),
    "north-york": (
        "Yonge and Sheppard's dense mixed-use corridor anchors North York's nights — "
        "karaoke rooms, izakayas, and K-pop lounges alongside mainstream bars and clubs."
    ),
}

# ─────────────────────────────────────────
# Sort order (matches display priority in the app)
# ─────────────────────────────────────────

SORT_ORDER: dict[str, int] = {
    "king-west": 1,
    "entertainment-district": 2,
    "kensington-market": 3,
    "ossington": 4,
    "little-italy": 5,
    "church-wellesley": 6,
    "distillery-district": 7,
    "leslieville": 8,
    "annex": 9,
    "yorkville": 10,
    "north-york": 11,
    "scarborough": 12,
}

# ─────────────────────────────────────────
# SQL
# ─────────────────────────────────────────

UPSERT_SQL = """
    INSERT INTO neighbourhood (name, slug, vibe_summary, lat, lng, sort_order)
    VALUES (%(name)s, %(slug)s, %(vibe_summary)s, %(lat)s, %(lng)s, %(sort_order)s)
    ON CONFLICT (slug) DO UPDATE SET
        name         = EXCLUDED.name,
        vibe_summary = EXCLUDED.vibe_summary,
        lat          = EXCLUDED.lat,
        lng          = EXCLUDED.lng,
        sort_order   = EXCLUDED.sort_order
    RETURNING id, (xmax = 0) AS inserted;
"""
# xmax = 0 means no previous version existed → it was an INSERT, not an UPDATE.


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

def run() -> dict:
    counts = {"inserted": 0, "updated": 0, "skipped": 0}

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            for n in TORONTO_NEIGHBOURHOODS:
                slug = n["slug"]
                params = {
                    "name": n["name"],
                    "slug": slug,
                    "vibe_summary": VIBE_SUMMARIES.get(slug),
                    "lat": n["lat"],
                    "lng": n["lng"],
                    "sort_order": SORT_ORDER.get(slug, 99),
                }

                cur.execute(UPSERT_SQL, params)
                row = cur.fetchone()
                action = "inserted" if row["inserted"] else "updated"
                counts[action] += 1
                log.info("%s  neighbourhood=%s  id=%s", action.upper(), slug, row["id"])

        conn.commit()
        log.info(
            "Done. inserted=%d  updated=%d  skipped=%d",
            counts["inserted"],
            counts["updated"],
            counts["skipped"],
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
