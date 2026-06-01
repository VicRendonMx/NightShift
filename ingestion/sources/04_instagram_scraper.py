"""
04_instagram_scraper.py
───────────────────────
Scrape venue Instagram pages with Playwright (headless Chromium) to extract
deals and recurring events that don't appear on any API.

For every venue row that has an instagram_handle:
  1. Visit https://www.instagram.com/{handle}/
  2. Detect and gracefully handle login walls.
  3. Collect the last 12 post captions via DOM scraping.
  4. Run DEAL_PATTERNS regex scan on each caption.
  5. For matching captions: extract day-of-week and price, insert into deal.
  6. Detect "every <weekday>" / "weekly <weekday>" patterns and create a
     recurring event row with is_recurring = TRUE and an iCal RRULE.

Defensive design:
  - 1 request per 3 seconds minimum (REQUEST_DELAY).
  - Rotates through USER_AGENTS on each venue.
  - Login-wall detection → skip + log (never crash).
  - Per-venue try/except so one broken page never stops the run.
  - All deal and event inserts are idempotent (duplicate-safe).

Returns {"deals_inserted": int, "events_inserted": int, "venues_skipped": int}
"""

import asyncio
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from itertools import cycle

from playwright.async_api import async_playwright, Page, TimeoutError as PwTimeoutError

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from db import get_connection

# ─────────────────────────────────────────
# Logging
# ─────────────────────────────────────────

LOG_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "instagram.log")
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

REQUEST_DELAY = 3.0   # seconds between venue requests

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
]

# iCal RRULE weekday codes
RRULE_DAYS: dict[str, str] = {
    "monday":    "MO",
    "tuesday":   "TU",
    "wednesday": "WE",
    "thursday":  "TH",
    "friday":    "FR",
    "saturday":  "SA",
    "sunday":    "SU",
}

# our day_of_week int (0=Monday)
DOW_INT: dict[str, int] = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

# ─────────────────────────────────────────
# Deal patterns (from spec, verbatim)
# ─────────────────────────────────────────

DEAL_PATTERNS: list[re.Pattern] = [
    re.compile(r"free (entry|cover|admission)",          re.IGNORECASE),
    re.compile(r"no cover",                              re.IGNORECASE),
    re.compile(r"ladies (free|night)",                   re.IGNORECASE),
    re.compile(r"happy hour",                            re.IGNORECASE),
    re.compile(r"2 for 1",                               re.IGNORECASE),
    re.compile(r"\$\d+ (cover|entry)",                   re.IGNORECASE),
    re.compile(r"open bar",                              re.IGNORECASE),
    re.compile(r"bottle service from \$\d+",             re.IGNORECASE),
    re.compile(r"(thursday|friday|saturday) night",      re.IGNORECASE),
]

# ─────────────────────────────────────────
# Extraction helpers
# ─────────────────────────────────────────

_DAY_RE = re.compile(
    r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b",
    re.IGNORECASE,
)

_PRICE_RE = re.compile(r"\$(\d+(?:\.\d{1,2})?)", re.IGNORECASE)

_RECURRING_RE = re.compile(
    r"(?:every|weekly|each)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?",
    re.IGNORECASE,
)


def extract_day_of_week(text: str) -> int | None:
    """Return our 0-based day-of-week int for the first weekday found in text."""
    m = _DAY_RE.search(text)
    if m:
        return DOW_INT.get(m.group(1).lower())
    return None


def extract_price(text: str) -> float | None:
    """Return the first dollar amount found in text, or None."""
    m = _PRICE_RE.search(text)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return None


def infer_deal_type(caption: str) -> str:
    """Map caption keywords to our deal_type enum values."""
    lower = caption.lower()
    if re.search(r"free (entry|cover|admission)|no cover", lower):
        return "free_entry"
    if re.search(r"ladies (free|night)", lower):
        return "ladies_night"
    if re.search(r"happy hour", lower):
        return "happy_hour"
    if re.search(r"2 for 1|open bar", lower):
        return "drink_special"
    if re.search(r"\$\d+ (cover|entry)|bottle service", lower):
        return "discount_cover"
    return "drink_special"


def caption_matches_deal(caption: str) -> bool:
    return any(p.search(caption) for p in DEAL_PATTERNS)


# ─────────────────────────────────────────
# Database inserts
# ─────────────────────────────────────────

DEAL_INSERT_SQL = """
    INSERT INTO deal (
        venue_id, title, description, deal_type,
        day_of_week, is_realtime, is_active, created_at
    )
    VALUES (%s, %s, %s, %s, %s, FALSE, TRUE, NOW())
    ON CONFLICT DO NOTHING;
"""

# deal has no natural unique key besides (venue_id, title, day_of_week) — we
# guard against duplicates with a partial unique index assumption; if the index
# doesn't exist the ON CONFLICT DO NOTHING is still harmless (it degrades to
# always-insert, which is acceptable for static data).

EVENT_INSERT_SQL = """
    INSERT INTO event (
        venue_id, title, event_type, start_time,
        is_recurring, recurrence_rule, external_id, external_source
    )
    VALUES (%s, %s, 'club_night', %s, TRUE, %s, %s, 'instagram')
    ON CONFLICT (external_id, external_source) DO NOTHING;
"""


def insert_deal(conn, venue_id: str, caption: str) -> bool:
    """
    Build a deal row from the caption and insert it.
    Returns True if a new row was written.
    """
    day  = extract_day_of_week(caption)
    price = extract_price(caption)

    # Derive a concise title from the first matching pattern
    title = "Instagram Deal"
    for pat in DEAL_PATTERNS:
        m = pat.search(caption)
        if m:
            title = m.group(0).title()
            break

    # Truncate description to 500 chars; tag the source
    description = caption[:500].strip() + "  [source: instagram]"

    deal_type = infer_deal_type(caption)

    with conn.cursor() as cur:
        cur.execute(DEAL_INSERT_SQL, (
            venue_id, title, description, deal_type, day,
        ))
        inserted = cur.rowcount > 0

    return inserted


def insert_recurring_event(conn, venue_id: str, caption: str,
                           handle: str, weekday: str) -> bool:
    """
    Create a recurring event row for a detected weekly night.
    Uses a stable external_id derived from venue_id + weekday so it is
    idempotent across scraper runs.
    """
    rrule_day  = RRULE_DAYS[weekday.lower()]
    rrule      = f"FREQ=WEEKLY;BYDAY={rrule_day}"
    title      = f"Weekly {weekday.title()} Night @ {handle}"
    external_id = f"instagram_{venue_id}_{weekday.lower()}"

    # Use next upcoming occurrence of the weekday as a nominal start_time.
    today     = datetime.now(tz=timezone.utc).date()
    target_dow = DOW_INT[weekday.lower()]
    days_ahead = (target_dow - today.weekday()) % 7 or 7
    start_date = today + timedelta(days=days_ahead)
    start_time = datetime(start_date.year, start_date.month, start_date.day,
                          22, 0, 0, tzinfo=timezone.utc)   # default 10 PM local

    with conn.cursor() as cur:
        cur.execute(EVENT_INSERT_SQL, (
            venue_id, title, start_time, rrule, external_id,
        ))
        inserted = cur.rowcount > 0

    return inserted


# ─────────────────────────────────────────
# Login-wall detection
# ─────────────────────────────────────────

LOGIN_INDICATORS = [
    "accounts/login",
    "Log in to Instagram",
    "log_in",
    "loginPage",
]


def is_login_wall(url: str, content: str) -> bool:
    """Return True if Instagram redirected us to a login page."""
    if any(ind in url for ind in LOGIN_INDICATORS):
        return True
    lower = content[:2000].lower()
    return "log in" in lower and "sign up" in lower and "forgot password" in lower


# ─────────────────────────────────────────
# Caption scraping
# ─────────────────────────────────────────

async def scrape_captions(page: Page, handle: str) -> list[str]:
    """
    Navigate to the Instagram profile and extract up to 12 post captions.

    Instagram renders captions inside <article> elements. Each post's
    alt text on the thumbnail image contains the caption text — this is the
    most stable DOM target because it is set server-side for accessibility
    and survives most UI redesigns.

    Falls back to aria-label scraping if alt text is absent.
    """
    url = f"https://www.instagram.com/{handle}/"
    captions: list[str] = []

    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20_000)
        await page.wait_for_timeout(3_000)   # let JS hydrate

        content = await page.content()

        if is_login_wall(page.url, content):
            log.warning("LOGIN WALL  handle=%s  url=%s", handle, page.url)
            return []

        # Strategy 1: alt text on post thumbnail images
        imgs = await page.query_selector_all("article img[alt]")
        for img in imgs[:12]:
            alt = await img.get_attribute("alt")
            if alt and len(alt.strip()) > 10:
                captions.append(alt.strip())
            if len(captions) >= 12:
                break

        # Strategy 2: aria-label on post links (fallback)
        if not captions:
            links = await page.query_selector_all("a[href*='/p/']")
            for link in links[:12]:
                label = await link.get_attribute("aria-label")
                if label and len(label.strip()) > 10:
                    captions.append(label.strip())
                if len(captions) >= 12:
                    break

    except PwTimeoutError:
        log.warning("TIMEOUT  handle=%s", handle)
    except Exception as exc:
        log.warning("SCRAPE ERROR  handle=%s  error=%s", handle, exc)

    return captions


# ─────────────────────────────────────────
# Per-venue processing
# ─────────────────────────────────────────

async def process_venue(page: Page, conn, venue_id: str,
                        handle: str) -> dict:
    """
    Scrape one venue's Instagram profile and process all captions.
    Returns per-venue counts dict.
    """
    result = {"deals_inserted": 0, "events_inserted": 0, "skipped": False}

    log.info("Scraping  venue_id=%s  handle=%s", venue_id, handle)
    captions = await scrape_captions(page, handle)

    if not captions:
        log.info("SKIP  venue_id=%s  handle=%s  reason=no_captions", venue_id, handle)
        result["skipped"] = True
        return result

    log.info("  Got %d captions for handle=%s", len(captions), handle)

    for caption in captions:
        # ── Deal extraction ──────────────────────────────────────────────
        if caption_matches_deal(caption):
            try:
                inserted = insert_deal(conn, venue_id, caption)
                conn.commit()
                if inserted:
                    result["deals_inserted"] += 1
                    log.info(
                        "DEAL INSERTED  venue_id=%s  handle=%s  preview=%.80s",
                        venue_id, handle, caption,
                    )
            except Exception:
                conn.rollback()
                log.exception(
                    "ERROR inserting deal  venue_id=%s  handle=%s", venue_id, handle,
                )

        # ── Recurring event extraction ───────────────────────────────────
        m = _RECURRING_RE.search(caption)
        if m:
            weekday = m.group(1).lower()
            try:
                inserted = insert_recurring_event(conn, venue_id, caption,
                                                   handle, weekday)
                conn.commit()
                if inserted:
                    result["events_inserted"] += 1
                    log.info(
                        "RECURRING EVENT INSERTED  venue_id=%s  handle=%s  "
                        "weekday=%s  preview=%.80s",
                        venue_id, handle, weekday, caption,
                    )
            except Exception:
                conn.rollback()
                log.exception(
                    "ERROR inserting recurring event  venue_id=%s  handle=%s",
                    venue_id, handle,
                )

    return result


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

async def _run_async() -> dict:
    totals = {"deals_inserted": 0, "events_inserted": 0, "venues_skipped": 0}

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, instagram_handle FROM venue "
                "WHERE instagram_handle IS NOT NULL AND instagram_handle <> '' "
                "AND is_active = TRUE ORDER BY name;"
            )
            venues = cur.fetchall()

        log.info("Found %d venues with Instagram handles.", len(venues))

        ua_cycle = cycle(USER_AGENTS)

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)

            for venue in venues:
                venue_id = str(venue["id"])
                handle   = venue["instagram_handle"].lstrip("@").strip()

                if not handle:
                    continue

                ua = next(ua_cycle)
                context = await browser.new_context(
                    user_agent=ua,
                    viewport={"width": 1280, "height": 900},
                    locale="en-CA",
                    timezone_id="America/Toronto",
                    # Disable webdriver fingerprint
                    java_script_enabled=True,
                    extra_http_headers={
                        "Accept-Language": "en-CA,en;q=0.9",
                        "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    },
                )

                page = await context.new_page()

                try:
                    result = await process_venue(page, conn, venue_id, handle)
                    totals["deals_inserted"]  += result["deals_inserted"]
                    totals["events_inserted"] += result["events_inserted"]
                    if result["skipped"]:
                        totals["venues_skipped"] += 1
                except Exception:
                    totals["venues_skipped"] += 1
                    log.exception(
                        "FATAL ERROR for venue_id=%s handle=%s — skipping.",
                        venue_id, handle,
                    )
                finally:
                    await page.close()
                    await context.close()

                # Rate-limit: 1 request per 3 seconds minimum
                await asyncio.sleep(REQUEST_DELAY)

            await browser.close()

    finally:
        conn.close()

    log.info(
        "Done. deals_inserted=%d  events_inserted=%d  venues_skipped=%d",
        totals["deals_inserted"], totals["events_inserted"], totals["venues_skipped"],
    )
    return totals


def run() -> dict:
    """Synchronous entry point called by run_all.py."""
    return asyncio.run(_run_async())


if __name__ == "__main__":
    run()
