# Observer Service — Phase 2

> **Status: NOT YET IMPLEMENTED**
>
> This directory is a placeholder. All components below will be built
> separately as the Phase 2 observer service. Do not add implementation
> code here until Phase 2 begins.

---

## What goes here

The observer service is a collection of background jobs and API endpoints
that keep the database alive with real-time and near-real-time signals.
Unlike the Phase 1 ingestion pipeline (which runs on demand and populates
static data), the observer service runs continuously or on a schedule.

---

## Planned components

### 1. Live Crowd Signal Aggregation

**File:** `observer/crowd_aggregator.py`

A cron job that runs every 5 minutes. For each active venue, it computes
a rolling 30-minute average of `checkin.crowd_rating` from recent check-ins
and writes a new row to `live_crowd_signal` with:

```
source      = 'checkin_aggregate'
crowd_pct   = derived from average rating (1–5 scaled to 0–100)
captured_at = NOW()
```

Old signal rows (> 2 hours) should be pruned to keep the table lean.

---

### 2. Google Popular Times Polling

**File:** `observer/popular_times_scraper.py`

A scheduled Playwright job that visits the Google Maps listing for each
venue (identified by `google_place_id`) and scrapes the "Popular times"
widget to extract current busyness percentage.

Inserts into `live_crowd_signal` with:

```
source    = 'google_popular_times'
crowd_pct = extracted busyness % (0–100)
```

Run frequency: every 15–30 minutes during operating hours (8 PM – 4 AM ET).

---

### 3. Real-Time Deal Push

**File:** `observer/deal_push_api.py`

A lightweight HTTP API endpoint (e.g. FastAPI) that venue operators call
to push a live deal. Writes to the `deal` table with:

```
is_realtime = TRUE
expires_at  = NOW() + deal duration (e.g. 2 hours)
```

Deals with `expires_at < NOW()` are considered expired and filtered out
by the app at read time. A cleanup job should also set `is_active = FALSE`
on expired real-time deals.

---

### 4. Post-Night Recap Trigger

**File:** `observer/recap_trigger.py`

A scheduled job that fires at **4:00 AM ET** each night. For every user
who has a `checkin.checked_in_at` timestamp from the past night (between
8 PM and 4 AM), it sends a push notification inviting them to log a
`night_recap`.

Integrates with the app's push notification service (TBD).

---

### 5. Safety Flag Review Queue

**File:** `observer/safety_queue.py` (or admin dashboard)

An admin-facing tool for reviewing `safety_flag` records with
`status = 'open'`. Allows moderators to:

- View flag details (venue, user if not anonymous, description, flag type)
- Mark as `reviewed` or `resolved`
- Set `resolved_at = NOW()`

Implementation approach (TBD): could be a simple CLI script, a web
dashboard, or integrated into an existing admin panel.

---

## Database tables used by the observer service

| Table               | Written by                          |
|---------------------|-------------------------------------|
| `live_crowd_signal` | crowd_aggregator, popular_times_scraper |
| `deal`              | deal_push_api (is_realtime = TRUE)  |
| `night_recap`       | recap_trigger (prompt only)         |
| `safety_flag`       | safety_queue (status updates)       |

---

## Notes

- All timestamps must be stored in **UTC** (`TIMESTAMPTZ`). Toronto is
  UTC−5 (EST) or UTC−4 (EDT). Convert to local time only at the
  presentation layer.
- The `live_crowd_signal` table already exists in `db/schema.sql` as a
  scaffold. No schema changes are needed to begin Phase 2.
- Credentials and API keys follow the same pattern as Phase 1: never
  hard-coded, always loaded from environment variables via `config.py`.
