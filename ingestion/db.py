"""
Database connection and upsert helpers for the NightShift ingestion pipeline.

All helpers accept an open psycopg2 connection and return the UUID of the
affected row as a string.  Callers are responsible for committing or rolling
back the transaction.
"""

import psycopg2
import psycopg2.extras
from config import DATABASE_URL


# ─────────────────────────────────────────
# Connection
# ─────────────────────────────────────────

def get_connection():
    """Return a psycopg2 connection using DATABASE_URL from the environment."""
    conn = psycopg2.connect(DATABASE_URL)
    # Use DictCursor by default so rows are accessible by column name.
    conn.cursor_factory = psycopg2.extras.DictCursor
    return conn


# ─────────────────────────────────────────
# Venue
# ─────────────────────────────────────────

def upsert_venue(conn, venue_dict: dict) -> str:
    """
    Insert or update a venue row keyed on google_place_id.

    venue_dict keys (all optional except name and google_place_id):
        name, slug, address, neighbourhood_id, lat, lng, venue_type,
        vibe_tags, music_genres, capacity, min_age, dress_code,
        has_cover_charge, cover_notes, google_place_id, google_rating,
        google_review_count, instagram_handle, website_url, phone,
        is_verified, is_active

    Returns the UUID of the inserted/updated row.
    """
    sql = """
        INSERT INTO venue (
            name, slug, address, neighbourhood_id, lat, lng,
            venue_type, vibe_tags, music_genres, capacity, min_age,
            dress_code, has_cover_charge, cover_notes, google_place_id,
            google_rating, google_review_count, instagram_handle,
            website_url, phone, is_verified, is_active
        ) VALUES (
            %(name)s, %(slug)s, %(address)s, %(neighbourhood_id)s, %(lat)s, %(lng)s,
            %(venue_type)s, %(vibe_tags)s, %(music_genres)s, %(capacity)s, %(min_age)s,
            %(dress_code)s, %(has_cover_charge)s, %(cover_notes)s, %(google_place_id)s,
            %(google_rating)s, %(google_review_count)s, %(instagram_handle)s,
            %(website_url)s, %(phone)s, %(is_verified)s, %(is_active)s
        )
        ON CONFLICT (google_place_id) DO UPDATE SET
            name              = EXCLUDED.name,
            slug              = EXCLUDED.slug,
            address           = EXCLUDED.address,
            lat               = EXCLUDED.lat,
            lng               = EXCLUDED.lng,
            venue_type        = EXCLUDED.venue_type,
            vibe_tags         = EXCLUDED.vibe_tags,
            music_genres      = EXCLUDED.music_genres,
            capacity          = EXCLUDED.capacity,
            dress_code        = EXCLUDED.dress_code,
            has_cover_charge  = EXCLUDED.has_cover_charge,
            cover_notes       = EXCLUDED.cover_notes,
            google_rating     = EXCLUDED.google_rating,
            google_review_count = EXCLUDED.google_review_count,
            instagram_handle  = EXCLUDED.instagram_handle,
            website_url       = EXCLUDED.website_url,
            phone             = EXCLUDED.phone,
            is_active         = EXCLUDED.is_active,
            updated_at        = NOW()
        RETURNING id;
    """
    defaults = {
        "slug": None,
        "address": None,
        "neighbourhood_id": None,
        "lat": None,
        "lng": None,
        "venue_type": None,
        "vibe_tags": None,
        "music_genres": None,
        "capacity": None,
        "min_age": 19,
        "dress_code": None,
        "has_cover_charge": False,
        "cover_notes": None,
        "google_place_id": None,
        "google_rating": None,
        "google_review_count": None,
        "instagram_handle": None,
        "website_url": None,
        "phone": None,
        "is_verified": False,
        "is_active": True,
    }
    params = {**defaults, **venue_dict}

    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return str(row["id"])


# ─────────────────────────────────────────
# Event
# ─────────────────────────────────────────

def upsert_event(conn, event_dict: dict) -> str:
    """
    Insert or update an event row keyed on (external_id, external_source).

    event_dict keys (required: venue_id, title, start_time, external_id, external_source):
        venue_id, title, description, event_type, music_genres,
        start_time, end_time, is_recurring, recurrence_rule, is_free,
        ticket_price_min, ticket_price_max, ticket_url, cover_image_url,
        external_id, external_source, is_cancelled

    Returns the UUID of the inserted/updated row.
    """
    sql = """
        INSERT INTO event (
            venue_id, title, description, event_type, music_genres,
            start_time, end_time, is_recurring, recurrence_rule, is_free,
            ticket_price_min, ticket_price_max, ticket_url, cover_image_url,
            external_id, external_source, is_cancelled
        ) VALUES (
            %(venue_id)s, %(title)s, %(description)s, %(event_type)s, %(music_genres)s,
            %(start_time)s, %(end_time)s, %(is_recurring)s, %(recurrence_rule)s, %(is_free)s,
            %(ticket_price_min)s, %(ticket_price_max)s, %(ticket_url)s, %(cover_image_url)s,
            %(external_id)s, %(external_source)s, %(is_cancelled)s
        )
        ON CONFLICT (external_id, external_source) DO UPDATE SET
            venue_id          = EXCLUDED.venue_id,
            title             = EXCLUDED.title,
            description       = EXCLUDED.description,
            event_type        = EXCLUDED.event_type,
            music_genres      = EXCLUDED.music_genres,
            start_time        = EXCLUDED.start_time,
            end_time          = EXCLUDED.end_time,
            is_recurring      = EXCLUDED.is_recurring,
            recurrence_rule   = EXCLUDED.recurrence_rule,
            is_free           = EXCLUDED.is_free,
            ticket_price_min  = EXCLUDED.ticket_price_min,
            ticket_price_max  = EXCLUDED.ticket_price_max,
            ticket_url        = EXCLUDED.ticket_url,
            cover_image_url   = EXCLUDED.cover_image_url,
            is_cancelled      = EXCLUDED.is_cancelled
        RETURNING id;
    """
    defaults = {
        "description": None,
        "event_type": None,
        "music_genres": None,
        "end_time": None,
        "is_recurring": False,
        "recurrence_rule": None,
        "is_free": False,
        "ticket_price_min": None,
        "ticket_price_max": None,
        "ticket_url": None,
        "cover_image_url": None,
        "is_cancelled": False,
    }
    params = {**defaults, **event_dict}

    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return str(row["id"])


# ─────────────────────────────────────────
# Performer
# ─────────────────────────────────────────

def upsert_performer(conn, performer_dict: dict) -> str:
    """
    Insert or update a performer row.

    Conflict resolution strategy:
      1. If songkick_id is provided, upsert on songkick_id.
      2. Otherwise, upsert on name (case-insensitive match via LOWER()).

    performer_dict keys (required: name):
        name, performer_type, genre, instagram_handle, spotify_id,
        songkick_id, bandsintown_id, is_local

    Returns the UUID of the inserted/updated row.
    """
    with conn.cursor() as cur:
        if performer_dict.get("songkick_id"):
            sql = """
                INSERT INTO performer (
                    name, performer_type, genre, instagram_handle,
                    spotify_id, songkick_id, bandsintown_id, is_local
                ) VALUES (
                    %(name)s, %(performer_type)s, %(genre)s, %(instagram_handle)s,
                    %(spotify_id)s, %(songkick_id)s, %(bandsintown_id)s, %(is_local)s
                )
                ON CONFLICT (songkick_id) DO UPDATE SET
                    name             = EXCLUDED.name,
                    performer_type   = EXCLUDED.performer_type,
                    genre            = EXCLUDED.genre,
                    instagram_handle = EXCLUDED.instagram_handle,
                    spotify_id       = EXCLUDED.spotify_id,
                    bandsintown_id   = EXCLUDED.bandsintown_id,
                    is_local         = EXCLUDED.is_local
                RETURNING id;
            """
        else:
            # Fall back to name-based upsert — fetch or insert.
            cur.execute(
                "SELECT id FROM performer WHERE LOWER(name) = LOWER(%(name)s)",
                {"name": performer_dict["name"]},
            )
            existing = cur.fetchone()
            if existing:
                return str(existing["id"])

            sql = """
                INSERT INTO performer (
                    name, performer_type, genre, instagram_handle,
                    spotify_id, songkick_id, bandsintown_id, is_local
                ) VALUES (
                    %(name)s, %(performer_type)s, %(genre)s, %(instagram_handle)s,
                    %(spotify_id)s, %(songkick_id)s, %(bandsintown_id)s, %(is_local)s
                )
                RETURNING id;
            """

        defaults = {
            "performer_type": None,
            "genre": None,
            "instagram_handle": None,
            "spotify_id": None,
            "songkick_id": None,
            "bandsintown_id": None,
            "is_local": False,
        }
        params = {**defaults, **performer_dict}
        cur.execute(sql, params)
        row = cur.fetchone()
        return str(row["id"])
