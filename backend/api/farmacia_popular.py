from __future__ import annotations
import logging

import asyncpg
from fastapi import APIRouter, Depends, Query

from api.deps import get_db
from services.medication_db import search_farmacia_popular, get_farmacia_popular_stats
from services.farmacia_popular import get_nearby_locations

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/farmacia-popular", tags=["farmacia-popular"])


@router.get("/medications")
async def list_medications(
    q: str | None = Query(None, min_length=2, max_length=200, description="Search term"),
    free: bool | None = Query(None, description="Filter free-of-charge medications only"),
    estado: str | None = Query(None, min_length=2, max_length=2, description="Brazilian state (UF)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Searchable, paginated list of Farmacia Popular medications."""
    if not pool:
        return {"total": 0, "medications": []}

    free_only = free is True
    discounted_only = free is False  # explicitly False means only discounted
    results = await search_farmacia_popular(
        pool, query=q, free_only=free_only, discounted_only=discounted_only,
        state=estado, limit=limit, offset=offset,
    )
    return {"total": len(results), "medications": results}


@router.get("/locations")
async def nearby_locations(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
    state: str | None = Query(None, min_length=2, max_length=2, description="Filter by state (UF)"),
    city: str | None = Query(None, max_length=100, description="Filter by city name"),
    limit: int = Query(20, ge=1, le=100),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Find nearby Farmacia Popular pharmacies by coordinates."""
    if not pool:
        return {"total": 0, "locations": []}

    locations = await get_nearby_locations(
        pool, lat=lat, lng=lng, limit=limit, state=state, city=city,
    )

    # Round distance for cleaner response
    for loc in locations:
        if "distance_km" in loc:
            loc["distance_km"] = round(loc["distance_km"], 2)

    return {"total": len(locations), "locations": locations}


@router.get("/stats")
async def stats(
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Aggregate statistics for Farmacia Popular medications."""
    if not pool:
        return {"total_eligible": 0, "total_free": 0, "total_discounted": 0}

    data = await get_farmacia_popular_stats(pool)
    return {
        "total_eligible": data.get("total_eligible", 0),
        "total_free": data.get("total_free", 0),
        "total_discounted": data.get("total_discounted", 0),
    }
