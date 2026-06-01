"""
Thin wrapper around python-slugify for consistent slug generation across
all ingestion scripts.
"""

from slugify import slugify as _slugify


def make_slug(text: str) -> str:
    """
    Convert a human-readable string into a URL-safe slug.

    Examples:
        "King West"          -> "king-west"
        "Coda Nightclub & Bar" -> "coda-nightclub-bar"
    """
    return _slugify(text, separator="-", lowercase=True)
