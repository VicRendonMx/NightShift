# Cursor Prompt — Toronto Nightlife App: Database Population (Static Data)

---

## Context & Goal

You are building the data pipeline for a **Toronto-specific nightlife app** whose core question is: *"Where will I go tonight?"*

This prompt covers **Phase 1 only: static data collection** — the permanent, slow-changing data that lives in the database and powers all discovery features. Dynamic/real-time data (crowd signals, check-ins, live deals) will be handled separately in Phase 2 with an observer-style service.

The stack is:
- **Database**: PostgreSQL (with `uuid-ossp` and array support)
- **Language**: Python 3.11+
- **Key libraries**: `psycopg2`, `requests`, `playwright` (for scraping), `python-dotenv`
- **APIs used**: Google Places API, Eventbrite API, Songkick API, Bandsintown API

All data must be **Toronto-scoped**. Never insert venues, events, or performers outside the Greater Toronto Area.

---

## Part 1 — Database Schema

Create the file `db/schema.sql`. This is the full PostgreSQL schema. Create all tables exactly as defined below. Run this first before any ingestion.

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────
-- STATIC LAYER
-- ─────────────────────────────────────────

CREATE TABLE neighbourhood (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    slug          TEXT NOT NULL UNIQUE,
    description   TEXT,
    vibe_summary  TEXT,
    lat           FLOAT,
    lng           FLOAT,
    sort_order    INT DEFAULT 0
);

CREATE TABLE venue (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              TEXT NOT NULL,
    slug              TEXT UNIQUE,
    address           TEXT,
    neighbourhood_id  UUID REFERENCES neighbourhood(id),
    lat               FLOAT,
    lng               FLOAT,
    venue_type        TEXT,           -- 'nightclub' | 'bar' | 'lounge' | 'rooftop' | 'afterhours' | 'live_music'
    vibe_tags         TEXT[],         -- e.g. ARRAY['good for dates','no dress code','lgbtq friendly']
    music_genres      TEXT[],         -- e.g. ARRAY['hip hop','house','techno']
    capacity          INT,
    min_age           INT DEFAULT 19,
    dress_code        TEXT,
    has_cover_charge  BOOLEAN DEFAULT FALSE,
    cover_notes       TEXT,
    google_place_id   TEXT UNIQUE,
    google_rating     FLOAT,
    google_review_count INT,
    instagram_handle  TEXT,
    website_url       TEXT,
    phone             TEXT,
    is_verified       BOOLEAN DEFAULT FALSE,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE hours (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id      UUID NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
    day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Monday
    open_time     TIME,
    close_time    TIME,
    is_closed     BOOLEAN DEFAULT FALSE,
    is_after_hours BOOLEAN DEFAULT FALSE  -- TRUE if close_time crosses midnight
);

CREATE TABLE venue_photo (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id    UUID NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    caption     TEXT,
    source      TEXT,   -- 'google' | 'instagram' | 'manual'
    is_primary  BOOLEAN DEFAULT FALSE,
    sort_order  INT DEFAULT 0,
    taken_at    TIMESTAMPTZ
);

CREATE TABLE performer (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name              TEXT NOT NULL,
    performer_type    TEXT,   -- 'dj' | 'band' | 'artist' | 'comedian'
    genre             TEXT,
    instagram_handle  TEXT,
    spotify_id        TEXT,
    songkick_id       TEXT,
    bandsintown_id    TEXT,
    is_local          BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id          UUID NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT,
    event_type        TEXT,   -- 'club_night' | 'live_music' | 'comedy' | 'themed_party' | 'festival'
    music_genres      TEXT[],
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ,
    is_recurring      BOOLEAN DEFAULT FALSE,
    recurrence_rule   TEXT,   -- iCal RRULE string, e.g. 'FREQ=WEEKLY;BYDAY=FR'
    is_free           BOOLEAN DEFAULT FALSE,
    ticket_price_min  FLOAT,
    ticket_price_max  FLOAT,
    ticket_url        TEXT,
    cover_image_url   TEXT,
    external_id       TEXT,
    external_source   TEXT,   -- 'eventbrite' | 'facebook' | 'songkick' | 'manual'
    is_cancelled      BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (external_id, external_source)
);

CREATE TABLE event_performer (
    event_id      UUID NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    performer_id  UUID NOT NULL REFERENCES performer(id) ON DELETE CASCADE,
    role          TEXT DEFAULT 'headliner',   -- 'headliner' | 'support' | 'resident'
    set_time      TIME,
    PRIMARY KEY (event_id, performer_id)
);

CREATE TABLE deal (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id        UUID NOT NULL REFERENCES venue(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    deal_type       TEXT,   -- 'free_entry' | 'drink_special' | 'ladies_night' | 'happy_hour' | 'discount_cover'
    day_of_week     INT CHECK (day_of_week BETWEEN 0 AND 6),  -- NULL = any day
    valid_from      TIME,
    valid_until     TIME,
    original_price  FLOAT,
    deal_price      FLOAT,
    is_realtime     BOOLEAN DEFAULT FALSE,  -- TRUE = pushed night-of by venue
    expires_at      TIMESTAMPTZ,            -- for real-time deals
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USER-GENERATED LAYER (scaffold only — populated by the app)
-- ─────────────────────────────────────────

CREATE TABLE app_user (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name        TEXT,
    email               TEXT UNIQUE,
    avatar_url          TEXT,
    preferred_vibes     TEXT[],
    preferred_genres    TEXT[],
    neighbourhood_pref  TEXT,
    budget_min          INT,
    budget_max          INT,
    min_age_pref        INT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    last_active_at      TIMESTAMPTZ
);

CREATE TABLE checkin (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES app_user(id),
    venue_id        UUID NOT NULL REFERENCES venue(id),
    event_id        UUID REFERENCES event(id),
    crowd_rating    INT CHECK (crowd_rating BETWEEN 1 AND 5),
    vibe_rating     INT CHECK (vibe_rating BETWEEN 1 AND 5),
    noise_level     INT CHECK (noise_level BETWEEN 1 AND 5),
    wait_time_min   INT,
    note            TEXT,
    is_anonymous    BOOLEAN DEFAULT FALSE,
    checked_in_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE review (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES app_user(id),
    venue_id        UUID NOT NULL REFERENCES venue(id),
    overall_rating  INT CHECK (overall_rating BETWEEN 1 AND 5),
    vibe_rating     INT CHECK (vibe_rating BETWEEN 1 AND 5),
    value_rating    INT CHECK (value_rating BETWEEN 1 AND 5),
    safety_rating   INT CHECK (safety_rating BETWEEN 1 AND 5),
    body            TEXT,
    is_anonymous    BOOLEAN DEFAULT FALSE,
    helpful_count   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE safety_flag (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id      UUID NOT NULL REFERENCES venue(id),
    user_id       UUID REFERENCES app_user(id),
    flag_type     TEXT,   -- 'harassment' | 'unsafe_environment' | 'overserving' | 'other'
    description   TEXT,
    status        TEXT DEFAULT 'open',   -- 'open' | 'reviewed' | 'resolved'
    flagged_at    TIMESTAMPTZ DEFAULT NOW(),
    resolved_at   TIMESTAMPTZ
);

CREATE TABLE group_plan (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_user_id   UUID REFERENCES app_user(id),
    name              TEXT,
    share_code        TEXT UNIQUE,
    planned_for       TIMESTAMPTZ,
    budget_per_person INT,
    status            TEXT DEFAULT 'voting',  -- 'voting' | 'decided' | 'done'
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_member (
    group_id    UUID NOT NULL REFERENCES group_plan(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES app_user(id),
    role        TEXT DEFAULT 'member',   -- 'creator' | 'member'
    joined_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_vote (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id    UUID NOT NULL REFERENCES group_plan(id) ON DELETE CASCADE,
    venue_id    UUID NOT NULL REFERENCES venue(id),
    user_id     UUID NOT NULL REFERENCES app_user(id),
    score       INT CHECK (score BETWEEN 1 AND 5),
    voted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE itinerary (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID REFERENCES app_user(id),
    group_id      UUID REFERENCES group_plan(id),
    title         TEXT,
    planned_for   TIMESTAMPTZ,
    total_budget  INT,
    share_code    TEXT UNIQUE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE itinerary_stop (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    itinerary_id    UUID NOT NULL REFERENCES itinerary(id) ON DELETE CASCADE,
    venue_id        UUID NOT NULL REFERENCES venue(id),
    event_id        UUID REFERENCES event(id),
    stop_order      INT NOT NULL,
    arrival_time    TIME,
    duration_min    INT,
    note            TEXT
);

CREATE TABLE loyalty_account (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL UNIQUE REFERENCES app_user(id),
    total_points      INT DEFAULT 0,
    lifetime_points   INT DEFAULT 0,
    tier              TEXT DEFAULT 'bronze',  -- 'bronze' | 'silver' | 'gold' | 'vip'
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE loyalty_transaction (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loyalty_account_id    UUID NOT NULL REFERENCES loyalty_account(id),
    checkin_id            UUID REFERENCES checkin(id),
    action_type           TEXT,   -- 'checkin' | 'review' | 'referral' | 'redemption'
    points_delta          INT NOT NULL,
    description           TEXT,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE night_recap (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES app_user(id),
    night_date      DATE NOT NULL,
    total_spent     INT,
    overall_rating  INT CHECK (overall_rating BETWEEN 1 AND 5),
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE night_recap_stop (
    recap_id      UUID NOT NULL REFERENCES night_recap(id) ON DELETE CASCADE,
    venue_id      UUID NOT NULL REFERENCES venue(id),
    stop_order    INT NOT NULL,
    amount_spent  INT,
    rating        INT CHECK (rating BETWEEN 1 AND 5),
    note          TEXT,
    PRIMARY KEY (recap_id, stop_order)
);

-- ─────────────────────────────────────────
-- DYNAMIC / OBSERVER LAYER (scaffold only — populated by Phase 2 observer service)
-- ─────────────────────────────────────────

CREATE TABLE live_crowd_signal (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id        UUID NOT NULL REFERENCES venue(id),
    crowd_pct       INT CHECK (crowd_pct BETWEEN 0 AND 100),
    wait_min        INT,
    source          TEXT,   -- 'checkin_aggregate' | 'door_api' | 'google_popular_times'
    captured_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_venue_neighbourhood ON venue(neighbourhood_id);
CREATE INDEX idx_venue_vibe_tags ON venue USING GIN(vibe_tags);
CREATE INDEX idx_venue_music_genres ON venue USING GIN(music_genres);
CREATE INDEX idx_venue_is_active ON venue(is_active);
CREATE INDEX idx_event_venue ON event(venue_id);
CREATE INDEX idx_event_start_time ON event(start_time);
CREATE INDEX idx_checkin_venue ON checkin(venue_id);
CREATE INDEX idx_checkin_time ON checkin(checked_in_at);
CREATE INDEX idx_live_crowd_venue ON live_crowd_signal(venue_id, captured_at DESC);
```

---

## Part 2 — Static Data Ingestion Pipeline

Create the following file and folder structure:

```
ingestion/
├── .env.example
├── requirements.txt
├── config.py
├── db.py
├── run_all.py
├── sources/
│   ├── 00_seed_neighbourhoods.py
│   ├── 01_google_places.py
│   ├── 02_eventbrite.py
│   ├── 03_songkick.py
│   └── 04_instagram_scraper.py
└── utils/
    ├── slugify.py
    └── toronto_bounds.py
```

### `.env.example`
```
DATABASE_URL=postgresql://user:password@localhost:5432/toronto_nightlife
GOOGLE_PLACES_API_KEY=your_key_here
EVENTBRITE_API_KEY=your_key_here
SONGKICK_API_KEY=your_key_here
BANDSINTOWN_APP_ID=your_app_id_here
```

### `requirements.txt`
```
psycopg2-binary
requests
python-dotenv
playwright
beautifulsoup4
python-slugify
```

### `utils/toronto_bounds.py`
Define the geographic bounding box and polygon for the Greater Toronto Area. All venue ingestion must check that coordinates fall within this boundary before inserting. Use these bounds:
- North: 43.855
- South: 43.580
- West: -79.640
- East: -79.115

Provide a function `is_in_toronto(lat, lng) -> bool`.

### `config.py`
Load all environment variables from `.env`. Expose constants: `DATABASE_URL`, `GOOGLE_PLACES_API_KEY`, `EVENTBRITE_API_KEY`, `SONGKICK_API_KEY`. Also define:
```python
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
```

### `db.py`
Create a database connection helper using `psycopg2`. Provide:
- `get_connection()` — returns a psycopg2 connection using `DATABASE_URL`
- `upsert_venue(conn, venue_dict) -> uuid` — insert or update on `google_place_id`
- `upsert_event(conn, event_dict) -> uuid` — insert or update on `(external_id, external_source)`
- `upsert_performer(conn, performer_dict) -> uuid` — insert or update on `songkick_id` or `name`

### `sources/00_seed_neighbourhoods.py`

Seed the `neighbourhood` table from the `TORONTO_NEIGHBOURHOODS` list in `config.py`. Use `ON CONFLICT (slug) DO UPDATE` so it is safe to re-run. Also add hand-written `vibe_summary` text for each neighbourhood — e.g.:

- King West: "Toronto's densest club strip. King Street West between Bathurst and Spadina is the epicentre of bottle service, high-energy dance floors, and late-night lineups."
- Entertainment District: "Home to the city's biggest venues — Rebel, Coda, Toybox. Best for EDM, large-capacity shows, and sporting-event overflow."
- Kensington Market: "Eclectic, indie, anti-mainstream. Dive bars, patio hangs, reggae and world music. The anti-King-West."
- Ossington: "Toronto's cocktail corridor. Low-key, creative-crowd bars. Best for first dates and pre-drinks."
- Church-Wellesley Village: "The heart of Toronto's LGBTQ+ scene. Inclusive, high-energy, welcoming to all."
- Leslieville: "East-end chill. Neighbourhood bars, live music, patio culture. More locals than tourists."
- Distillery District: "Cobblestone streets, upscale cocktail bars, artisanal everything. Date-night central."
- Annex / Little Italy / Yorkville: fill with appropriate summaries.

### `sources/01_google_places.py`

Use the **Google Places API (New)** to populate `venue`, `hours`, and `venue_photo`.

**Step 1 — Discovery.** For each search term in `TORONTO_NIGHTLIFE_SEARCH_TERMS`, call the Places API `searchText` endpoint. Paginate through all results using `nextPageToken`. Collect all unique `place_id` values.

**Step 2 — Detail fetch.** For each `place_id`, call the Places API `getPlace` endpoint requesting these fields:
`id,displayName,formattedAddress,location,types,regularOpeningHours,rating,userRatingCount,photos,websiteUri,nationalPhoneNumber,editorialSummary,priceLevel`

**Step 3 — Toronto filter.** Before inserting, call `is_in_toronto(lat, lng)`. Skip any venue outside Toronto bounds.

**Step 4 — Type mapping.** Map Google `types` to our `venue_type`:
```python
TYPE_MAP = {
    "night_club": "nightclub",
    "bar": "bar",
    "live_music_venue": "live_music",
    "comedy_club": "comedy",
    "rooftop_bar": "rooftop",
}
```

**Step 5 — Neighbourhood assignment.** After inserting, run a spatial nearest-neighbour query to assign `neighbourhood_id` based on proximity to neighbourhood centroid coordinates. Use:
```sql
UPDATE venue SET neighbourhood_id = (
    SELECT id FROM neighbourhood
    ORDER BY point(lng, lat) <-> point(venue.lng, venue.lat)
    LIMIT 1
) WHERE neighbourhood_id IS NULL;
```

**Step 6 — Hours.** Parse `regularOpeningHours.periods` from the Places response and insert into the `hours` table. For each period, set `is_after_hours = TRUE` if `close_time` < `open_time` (crosses midnight).

**Step 7 — Photos.** For each place, fetch the first 5 photo references using the Places Photos API and store URLs in `venue_photo`. Mark `is_primary = TRUE` for the first photo.

**Step 8 — Vibe tag inference.** After inserting all venues, run a second pass that calls the Places API `editorialSummary` plus the venue name and maps keywords to `vibe_tags`. Use this keyword map:
```python
VIBE_KEYWORD_MAP = {
    "rooftop": "rooftop",
    "patio": "patio",
    "lgbtq": "lgbtq friendly",
    "gay": "lgbtq friendly",
    "latin": "latin vibes",
    "karaoke": "karaoke",
    "comedy": "comedy night",
    "jazz": "jazz",
    "cocktail": "craft cocktails",
    "dive": "dive bar",
    "sports": "sports bar",
    "live music": "live music",
    "after hours": "after hours",
    "bottle service": "bottle service",
}
```

Log all inserted and skipped venues to `ingestion/logs/google_places.log`.

### `sources/02_eventbrite.py`

Use the **Eventbrite API v3** to populate `event`.

- Endpoint: `GET https://www.eventbriteapi.com/v3/events/search/`
- Required params: `location.address=Toronto, ON`, `location.within=15km`, `categories=103` (music), `expand=venue,ticket_availability`
- Also query category `105` (performing arts) and `110` (food & drink) for comedy and bar events
- Paginate using `continuation` token until exhausted
- For each event: check that the associated venue exists in our `venue` table (match on `google_place_id` or address fuzzy match). If not found, skip — we only want events at venues already in our database
- Set `external_source = 'eventbrite'` and `external_id = event.id`
- Parse `ticket_availability` for price range
- Use `ON CONFLICT (external_id, external_source) DO UPDATE` for idempotency
- Log inserted/skipped to `ingestion/logs/eventbrite.log`

### `sources/03_songkick.py`

Use the **Songkick API** to populate `event`, `performer`, and `event_performer`.

- Metro area ID for Toronto: `17835`
- Endpoint: `GET https://api.songkick.com/api/3.0/metro_areas/17835/calendar.json`
- Paginate through all pages
- For each event:
  1. Upsert the `performer` (artist) — set `songkick_id`, `name`, `genre` if available
  2. Upsert the `event` with `external_source = 'songkick'`
  3. Insert `event_performer` linking them
- Only insert if the event's venue address is within Toronto bounds
- Log to `ingestion/logs/songkick.log`

### `sources/04_instagram_scraper.py`

Use **Playwright** (headless Chromium) to scrape venue Instagram pages for deals and recurring events that don't appear on any API.

This is the most fragile source — build it defensively.

**Target**: For each venue in the database that has an `instagram_handle`, visit `https://www.instagram.com/{handle}/` and collect the last 12 post captions.

**Deal extraction**: Pass each caption to a simple keyword pattern match to identify deals:
```python
DEAL_PATTERNS = [
    r"free (entry|cover|admission)",
    r"no cover",
    r"ladies (free|night)",
    r"happy hour",
    r"2 for 1",
    r"\$\d+ (cover|entry)",
    r"open bar",
    r"bottle service from \$\d+",
    r"(thursday|friday|saturday) night",
]
```

For any caption matching a deal pattern:
- Extract the day of week if mentioned
- Extract the price if mentioned
- Insert into `deal` table with `is_realtime = FALSE` and `is_active = TRUE`
- Set `source = 'instagram'` in a `notes` field

**Recurring event extraction**: Captions mentioning weekly recurring nights (e.g. "Every Friday", "Weekly Saturdays") should also create an `event` record with `is_recurring = TRUE` and `recurrence_rule` set to the appropriate iCal RRULE.

Rate-limit to 1 request per 3 seconds. Rotate user agents. Handle login walls gracefully — if redirected to login page, skip and log.

Log all extracted deals to `ingestion/logs/instagram.log`.

---

## Part 3 — Orchestrator

### `run_all.py`

Create a master orchestration script that runs all ingestion sources in order:

```
1. 00_seed_neighbourhoods.py
2. 01_google_places.py
3. 02_eventbrite.py
4. 03_songkick.py
5. 04_instagram_scraper.py
```

- Run each script as a subprocess or imported module
- Log start time, end time, and record counts for each step
- Print a final summary table:
  ```
  ┌──────────────────────────┬──────────┬──────────┬──────────┐
  │ Source                   │ Inserted │ Updated  │ Skipped  │
  ├──────────────────────────┼──────────┼──────────┼──────────┤
  │ Neighbourhoods           │       12 │        0 │        0 │
  │ Google Places (venues)   │      ---  │      --- │      --- │
  │ Eventbrite (events)      │      --- │      --- │      --- │
  │ Songkick (events)        │      --- │      --- │      --- │
  │ Instagram (deals)        │      --- │      --- │      --- │
  └──────────────────────────┴──────────┴──────────┴──────────┘
  ```
- Exit with code 1 if any step fails

---

## Part 4 — What's NOT in scope here (Phase 2 — Observer Service)

Do not implement the following now. Just create placeholder files `observer/README.md` noting they will be built separately:

- **Live crowd signal aggregation** — rolling 30-min average of `checkin.crowd_rating` written to `live_crowd_signal` every 5 minutes via a cron job
- **Google Popular Times polling** — periodic scrape of Google Maps "popular times" widget for each venue using Playwright, inserted into `live_crowd_signal` with `source = 'google_popular_times'`
- **Real-time deal push** — venue-facing API endpoint that writes to `deal` with `is_realtime = TRUE` and `expires_at` set
- **Post-night recap trigger** — a scheduled job that, at 4am each night, sends a push notification to users who checked in that night inviting them to log a recap
- **Safety flag review queue** — admin tool for reviewing `safety_flag` records

---

## Constraints & notes

- All timestamps must be stored in **UTC** with timezone (`TIMESTAMPTZ`). Toronto is UTC-5 (EST) or UTC-4 (EDT). Convert on read.
- The `min_age` default on `venue` is **19** — the legal drinking age in Ontario.
- Every insert script must be **idempotent** — safe to re-run without duplicating data. Use `ON CONFLICT ... DO UPDATE` or `DO NOTHING` throughout.
- Never hard-code API keys. Always read from environment variables via `config.py`.
- Add a `updated_at` trigger on `venue` so the column auto-updates on any row change:
  ```sql
  CREATE OR REPLACE FUNCTION update_updated_at()
  RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER venue_updated_at BEFORE UPDATE ON venue FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  ```
- The `vibe_tags` and `music_genres` columns are `TEXT[]` (Postgres arrays). Use GIN indexes for efficient array contains queries: `WHERE 'rooftop' = ANY(vibe_tags)`.
- Log everything. Each source script writes to its own log file under `ingestion/logs/`. Logs should include timestamp, record ID, and action (inserted / updated / skipped / error).
