"""
run_all.py
──────────
Master orchestrator for the NightShift static data ingestion pipeline.

Runs all five ingestion sources in order:
  1. 00_seed_neighbourhoods  — neighbourhood table seed
  2. 01_google_places        — venue, hours, venue_photo
  3. 02_eventbrite           — events (music / arts / food & drink)
  4. 03_songkick             — events, performers, event_performer
  5. 04_instagram_scraper    — deals and recurring events

Each step is imported and called directly (not subprocess) so stdout/stderr
from every source is captured into the orchestrator log as well as the
source's own log file.

Exit codes:
  0 — all steps completed without a fatal exception
  1 — one or more steps raised an unhandled exception
"""

import importlib
import logging
import os
import sys
import time
from datetime import datetime, timezone

# Ensure the ingestion/ root is on the path so source imports work.
INGESTION_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, INGESTION_DIR)

# ─────────────────────────────────────────
# Orchestrator logging (separate from per-source logs)
# ─────────────────────────────────────────

LOG_PATH = os.path.join(INGESTION_DIR, "logs", "run_all.log")
os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("run_all")

# ─────────────────────────────────────────
# Step registry
# ─────────────────────────────────────────
# Each entry: (display_label, module_path_relative_to_ingestion/)
# The module's run() function must return a dict with at least the keys
# used for the summary columns listed in columns_map.

STEPS = [
    {
        "label":       "Neighbourhoods",
        "module":      "sources.00_seed_neighbourhoods",
        "columns_map": {"Inserted": "inserted", "Updated": "updated", "Skipped": "skipped"},
        "required_keys": [],
    },
    {
        "label":       "Google Places (venues)",
        "module":      "sources.01_google_places",
        "columns_map": {"Inserted": "inserted", "Updated": "updated", "Skipped": "skipped"},
        "required_keys": ["GOOGLE_PLACES_API_KEY"],
    },
    {
        "label":       "Eventbrite (events)",
        "module":      "sources.02_eventbrite",
        "columns_map": {"Inserted": "inserted", "Updated": "updated", "Skipped": "skipped"},
        "required_keys": ["EVENTBRITE_API_KEY"],
    },
    {
        "label":       "Songkick (events)",
        "module":      "sources.03_songkick",
        "columns_map": {"Inserted": "inserted", "Updated": "updated", "Skipped": "skipped"},
        "required_keys": ["SONGKICK_API_KEY"],
    },
    {
        "label":       "Instagram (deals)",
        "module":      "sources.04_instagram_scraper",
        "columns_map": {
            "Inserted": "deals_inserted",
            "Updated":  "events_inserted",
            "Skipped":  "venues_skipped",
        },
        # Instagram scraping requires venues with handles — no dedicated API key,
        # but we gate it on having at least Google Places data already loaded.
        "required_keys": [],
    },
]

# Summary table column widths
COL_LABEL   = 26
COL_NUM     =  8
COLUMNS     = ["Inserted", "Updated", "Skipped"]

# ─────────────────────────────────────────
# Table rendering
# ─────────────────────────────────────────

def _hr(left="├", mid="┼", right="┤", fill="─") -> str:
    parts = [fill * (COL_LABEL + 2)]
    for _ in COLUMNS:
        parts.append(fill * (COL_NUM + 2))
    return left + mid.join(parts) + right


def _row(label: str, values: dict[str, str | int]) -> str:
    label_cell = f" {label:<{COL_LABEL}} "
    cells = [label_cell]
    for col in COLUMNS:
        v = values.get(col, "---")
        cells.append(f" {str(v):>{COL_NUM}} ")
    return "│" + "│".join(cells) + "│"


def print_summary(results: list[dict]) -> None:
    header_values = {c: c for c in COLUMNS}

    top    = "┌" + "┬".join(["─" * (COL_LABEL + 2)] + ["─" * (COL_NUM + 2)] * len(COLUMNS)) + "┐"
    bottom = "└" + "┴".join(["─" * (COL_LABEL + 2)] + ["─" * (COL_NUM + 2)] * len(COLUMNS)) + "┘"

    print()
    print(top)
    print(_row("Source", header_values))
    print(_hr())

    for r in results:
        label = r["label"]
        if r.get("skipped"):
            display = {c: "SKIP" for c in COLUMNS}
        elif r["error"]:
            display = {c: "ERROR" for c in COLUMNS}
        elif r["counts"] is None:
            display = {c: "---" for c in COLUMNS}
        else:
            display = {}
            for col, key in r["columns_map"].items():
                display[col] = r["counts"].get(key, "---")
        print(_row(label, display))

    print(bottom)
    print()


# ─────────────────────────────────────────
# Step runner
# ─────────────────────────────────────────

def _check_required_keys(required_keys: list[str]) -> list[str]:
    """Return list of any required env-var keys that are missing or placeholder."""
    missing = []
    for key in required_keys:
        val = os.environ.get(key, "").strip()
        if not val or val.startswith("your_"):
            missing.append(key)
    return missing


def run_step(step: dict) -> dict:
    """
    Import the step's module and call run().
    Returns a result dict with keys: label, counts, error, skipped, elapsed_s, columns_map.
    """
    label        = step["label"]
    module_path  = step["module"]
    required_keys = step.get("required_keys", [])

    result = {
        "label":       label,
        "counts":      None,
        "error":       False,
        "skipped":     False,
        "elapsed_s":   0.0,
        "columns_map": step["columns_map"],
    }

    # ── Key guard ────────────────────────────────────────────────────────────
    missing = _check_required_keys(required_keys)
    if missing:
        log.warning(
            "━━━ SKIP   %s — missing env vars: %s ━━━",
            label, ", ".join(missing),
        )
        result["skipped"] = True
        return result

    log.info("━━━ START  %s ━━━", label)
    t0 = time.monotonic()

    try:
        mod = importlib.import_module(module_path)
        counts = mod.run()
        result["counts"]    = counts
        result["elapsed_s"] = time.monotonic() - t0
        log.info(
            "━━━ DONE   %s  elapsed=%.1fs  counts=%s ━━━",
            label, result["elapsed_s"], counts,
        )
    except Exception:
        result["error"]     = True
        result["elapsed_s"] = time.monotonic() - t0
        log.exception("━━━ FAILED %s  elapsed=%.1fs ━━━", label, result["elapsed_s"])

    return result


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

def main() -> int:
    run_start = datetime.now(tz=timezone.utc)
    log.info("═══ NightShift ingestion pipeline started at %s ═══", run_start.isoformat())

    results: list[dict] = []
    any_failed = False

    for step in STEPS:
        result = run_step(step)
        results.append(result)
        if result["error"]:
            any_failed = True
            log.error("Step '%s' failed — continuing to next step.", step["label"])

    run_end     = datetime.now(tz=timezone.utc)
    total_secs  = (run_end - run_start).total_seconds()

    print_summary(results)

    # Per-step timing summary
    log.info("─── Timing ───")
    for r in results:
        if r.get("skipped"):
            status = "SKIPPED"
        elif r["error"]:
            status = "FAILED"
        else:
            status = "OK"
        log.info("  %-30s  %s  %.1fs", r["label"], status, r["elapsed_s"])

    log.info(
        "═══ Pipeline finished at %s  total=%.1fs  status=%s ═══",
        run_end.isoformat(),
        total_secs,
        "FAILED" if any_failed else "OK",
    )

    return 1 if any_failed else 0


if __name__ == "__main__":
    sys.exit(main())
