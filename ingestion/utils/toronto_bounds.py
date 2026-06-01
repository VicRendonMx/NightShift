"""
Geographic boundary check for the Greater Toronto Area.

Bounding box:
  North:  43.855
  South:  43.580
  West:  -79.640
  East:  -79.115
"""

GTA_BOUNDS = {
    "north": 43.855,
    "south": 43.580,
    "west": -79.640,
    "east": -79.115,
}


def is_in_toronto(lat: float, lng: float) -> bool:
    """Return True if the given coordinates fall within the GTA bounding box."""
    return (
        GTA_BOUNDS["south"] <= lat <= GTA_BOUNDS["north"]
        and GTA_BOUNDS["west"] <= lng <= GTA_BOUNDS["east"]
    )
