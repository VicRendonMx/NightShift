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

-- updated_at trigger on venue
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER venue_updated_at
    BEFORE UPDATE ON venue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
