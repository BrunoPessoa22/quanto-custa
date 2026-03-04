from __future__ import annotations
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_db
from services.medication_db import (
    get_medication_by_id,
    get_medication_by_slug,
    get_medication_with_equivalents,
    get_farmacia_popular_drugs,
    get_pmc_column,
)
from services.formatter import format_medication_comparison

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/medications", tags=["medications"])


@router.get("/popular")
async def popular_medications(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """List Farmacia Popular eligible drugs."""
    if not pool:
        return {"count": 0, "medications": []}
    drugs = await get_farmacia_popular_drugs(pool, limit, offset)
    return {"count": len(drugs), "medications": drugs}


@router.get("/slug/{slug}")
async def medication_by_slug(
    slug: str,
    state: str | None = Query(None, min_length=2, max_length=2),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Lookup medication by URL slug (for SEO pages)."""
    if not pool:
        raise HTTPException(503, "Database not configured")
    med = await get_medication_by_slug(pool, slug)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    pmc_col = get_pmc_column(state)
    med["pmc_price"] = med.get(pmc_col)
    return med


@router.get("/{medication_id}")
async def medication_detail(
    medication_id: int,
    state: str | None = Query(None, min_length=2, max_length=2),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Full medication detail with equivalents."""
    if not pool:
        raise HTTPException(503, "Database not configured")
    med = await get_medication_with_equivalents(pool, medication_id, state)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    equivalents = med.pop("equivalents", [])
    med.pop("reference_drug", None)

    return format_medication_comparison(med, equivalents, state)


@router.get("/{medication_id}/equivalents")
async def medication_equivalents(
    medication_id: int,
    state: str | None = Query(None, min_length=2, max_length=2),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Get all generics/similars for a medication."""
    if not pool:
        raise HTTPException(503, "Database not configured")
    med = await get_medication_with_equivalents(pool, medication_id, state)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    equivalents = med.get("equivalents", [])
    reference_drug = med.get("reference_drug")

    return {
        "medication_id": medication_id,
        "equivalents": equivalents,
        "reference_drug": reference_drug,
        "count": len(equivalents),
    }
