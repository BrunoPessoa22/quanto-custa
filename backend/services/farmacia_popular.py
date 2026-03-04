from __future__ import annotations
import logging

import asyncpg

logger = logging.getLogger(__name__)


async def get_nearby_locations(
    pool: asyncpg.Pool,
    lat: float,
    lng: float,
    limit: int = 20,
    state: str | None = None,
    city: str | None = None,
) -> list[dict]:
    """Find nearby Farmacia Popular locations using Haversine distance.

    Uses a pure-SQL Haversine formula (no PostGIS required).
    """
    params: list = [lat, lng]
    filters: list[str] = ["active = TRUE"]
    param_idx = 3  # $1=lat, $2=lng, next available

    if state:
        filters.append(f"state = ${param_idx}")
        params.append(state.upper())
        param_idx += 1

    if city:
        filters.append(f"unaccent(lower(city)) = unaccent(lower(${param_idx}))")
        params.append(city)
        param_idx += 1

    where_clause = " AND ".join(filters)
    limit_placeholder = f"${param_idx}"
    params.append(limit)

    sql = f"""
        SELECT *,
            (6371 * acos(
                cos(radians($1)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(latitude))
            )) AS distance_km
        FROM farmacia_popular_locations
        WHERE {where_clause}
        ORDER BY distance_km
        LIMIT {limit_placeholder}
    """

    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]
