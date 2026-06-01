import os
import warnings
from dotenv import load_dotenv

load_dotenv()

# ── Required keys — pipeline cannot run without these ──────────────────────
DATABASE_URL          = os.environ["DATABASE_URL"]
GOOGLE_PLACES_API_KEY = os.environ["GOOGLE_PLACES_API_KEY"]
EVENTBRITE_API_KEY    = os.environ["EVENTBRITE_API_KEY"]

# ── Optional keys — steps that need them are skipped gracefully if absent ──
def _optional(key: str) -> str | None:
    val = os.environ.get(key, "").strip()
    if not val or val.startswith("your_"):
        warnings.warn(
            f"{key} is not set — the step that uses it will be skipped.",
            stacklevel=2,
        )
        return None
    return val

SONGKICK_API_KEY  = _optional("SONGKICK_API_KEY")
BANDSINTOWN_APP_ID = _optional("BANDSINTOWN_APP_ID")

TORONTO_NIGHTLIFE_SEARCH_TERMS = [
    "nightclub Toronto",
    "bar Toronto",
    "lounge Toronto",
    "rooftop bar Toronto",
    "after hours club Toronto",
    "live music venue Toronto",
    "karaoke bar Toronto",
    "comedy club Toronto",
    "dance club Toronto",
    "jazz bar Toronto",
]

TORONTO_NEIGHBOURHOODS = [
    {"name": "King West", "slug": "king-west", "lat": 43.6441, "lng": -79.4023},
    {"name": "Entertainment District", "slug": "entertainment-district", "lat": 43.6474, "lng": -79.3870},
    {"name": "Kensington Market", "slug": "kensington-market", "lat": 43.6540, "lng": -79.4009},
    {"name": "Little Italy", "slug": "little-italy", "lat": 43.6553, "lng": -79.4196},
    {"name": "Ossington", "slug": "ossington", "lat": 43.6522, "lng": -79.4243},
    {"name": "Leslieville", "slug": "leslieville", "lat": 43.6610, "lng": -79.3313},
    {"name": "Church-Wellesley Village", "slug": "church-wellesley", "lat": 43.6651, "lng": -79.3810},
    {"name": "Distillery District", "slug": "distillery-district", "lat": 43.6503, "lng": -79.3595},
    {"name": "Annex", "slug": "annex", "lat": 43.6700, "lng": -79.4085},
    {"name": "Yorkville", "slug": "yorkville", "lat": 43.6718, "lng": -79.3924},
    {"name": "Scarborough", "slug": "scarborough", "lat": 43.7735, "lng": -79.2577},
    {"name": "North York", "slug": "north-york", "lat": 43.7615, "lng": -79.4111},
]
