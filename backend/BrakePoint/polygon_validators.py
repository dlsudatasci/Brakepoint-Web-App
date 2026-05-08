"""
Pure-Python polygon validation utilities — no external geometry dependencies.

Coordinate format: [[lng, lat], [lng, lat], ...]  (same as Terra Draw / GeoJSON ring)
"""

from typing import List, Tuple

Coord = Tuple[float, float]
Ring = List[Coord]


# ---------------------------------------------------------------------------
# Format / coordinate validation
# ---------------------------------------------------------------------------

def _parse_coord(c) -> Coord:
    """Parse and range-check a single [lng, lat] pair."""
    if not (isinstance(c, (list, tuple)) and len(c) == 2):
        raise ValueError(f"Each coordinate must be [lng, lat], got {c!r}")
    lng, lat = float(c[0]), float(c[1])
    if not (-180.0 <= lng <= 180.0):
        raise ValueError(f"Longitude {lng} is out of range [-180, 180]")
    if not (-90.0 <= lat <= 90.0):
        raise ValueError(f"Latitude {lat} is out of range [-90, 90]")
    return (lng, lat)


def validate_geometry(geometry) -> Ring:
    """
    Validate that *geometry* is a list of valid [lng, lat] coordinate pairs.
    Returns a cleaned ring (closing duplicate removed if present, ≥ 3 vertices).
    Raises ValueError with a descriptive message on invalid input.
    """
    if not isinstance(geometry, (list, tuple)):
        raise ValueError("geometry must be a list of [lng, lat] coordinate pairs")

    ring: Ring = [_parse_coord(c) for c in geometry]

    # Remove the closing duplicate vertex produced by some libraries (e.g. GeoJSON)
    if len(ring) >= 2 and ring[0] == ring[-1]:
        ring = ring[:-1]

    if len(ring) < 3:
        raise ValueError("A polygon must have at least 3 distinct vertices")

    return ring


# ---------------------------------------------------------------------------
# Degenerate polygon (zero / near-zero area)
# ---------------------------------------------------------------------------

def is_degenerate(ring: Ring, threshold: float = 1e-10) -> bool:
    """Return True when the polygon encloses effectively zero area (shoelace formula)."""
    n = len(ring)
    area = 0.0
    for i in range(n):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % n]
        area += (x1 * y2) - (x2 * y1)
    return abs(area) / 2.0 < threshold


# ---------------------------------------------------------------------------
# Self-intersection check
# ---------------------------------------------------------------------------

def _cross(o: Coord, a: Coord, b: Coord) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _segments_intersect(p1: Coord, p2: Coord, p3: Coord, p4: Coord) -> bool:
    """Return True when segment p1-p2 properly intersects segment p3-p4."""
    d1 = _cross(p3, p4, p1)
    d2 = _cross(p3, p4, p2)
    d3 = _cross(p1, p2, p3)
    d4 = _cross(p1, p2, p4)

    if ((d1 > 0 and d2 < 0) or (d1 < 0 and d2 > 0)) and \
       ((d3 > 0 and d4 < 0) or (d3 < 0 and d4 > 0)):
        return True
    return False


def is_self_intersecting(ring: Ring) -> bool:
    """Return True when the polygon ring has at least one self-intersection."""
    n = len(ring)
    if n < 4:
        return False  # A triangle cannot self-intersect

    edges = [(ring[i], ring[(i + 1) % n]) for i in range(n)]

    for i in range(len(edges)):
        for j in range(i + 2, len(edges)):
            # Skip adjacent edges that share a vertex
            if i == 0 and j == len(edges) - 1:
                continue
            if _segments_intersect(edges[i][0], edges[i][1],
                                   edges[j][0], edges[j][1]):
                return True
    return False


# ---------------------------------------------------------------------------
# Point-in-polygon  (ray-casting)
# ---------------------------------------------------------------------------

def point_in_polygon(point: Coord, ring: Ring) -> bool:
    """Return True when *point* (lng, lat) is inside *ring* (ray-casting algorithm)."""
    px, py = point
    n = len(ring)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def polygon_within_polygon(inner: Ring, outer: Ring) -> bool:
    """Return True when every vertex of *inner* lies inside *outer*."""
    return all(point_in_polygon(pt, outer) for pt in inner)
