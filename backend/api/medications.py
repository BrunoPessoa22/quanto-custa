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


@router.get("/top")
async def top_medications(
    limit: int = Query(100, ge=1, le=1000),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Return top medications for static generation (slug + name)."""
    if not pool:
        return []
    rows = await pool.fetch(
        "SELECT id, product_name FROM medications ORDER BY id LIMIT $1", limit
    )
    results = []
    for r in rows:
        name = r["product_name"]
        mid = r["id"]
        slug = f"{_slugify(name)}-{mid}"
        results.append({"slug": slug, "name": name})
    return results


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


@router.get("/{slug}")
async def medication_by_slug_or_id(
    slug: str,
    estado: str | None = Query(None, min_length=2, max_length=2),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Lookup medication by slug (e.g. 'dipirona-11610') or numeric ID."""
    if not pool:
        raise HTTPException(503, "Database not configured")

    # Try to extract numeric ID from end of slug (e.g. 'dipirona-11610' -> 11610)
    medication_id = _extract_id(slug)

    if medication_id:
        med = await get_medication_with_equivalents(pool, medication_id, estado)
        if med:
            equivalents = med.pop("equivalents", [])
            reference_drug = med.pop("reference_drug", None)

            # If this med is a generic/similar (no direct equivalents but has a reference),
            # fetch the reference's equivalents so we show sibling alternatives
            if not equivalents and reference_drug:
                ref_med = await get_medication_with_equivalents(
                    pool, reference_drug["id"], estado
                )
                if ref_med:
                    siblings = ref_med.pop("equivalents", [])
                    # Include the reference itself + siblings, excluding current med
                    all_related = [reference_drug] + [
                        s for s in siblings if s.get("id") != medication_id
                    ]
                    equivalents = all_related

            return format_medication_comparison(med, equivalents, estado)

    # Fallback: try as full slug via DB lookup
    med = await get_medication_by_slug(pool, slug)
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")

    pmc_col = get_pmc_column(estado)
    med["pmc_price"] = med.get(pmc_col)
    return med


@router.get("/{slug}/equivalents")
async def medication_equivalents(
    slug: str,
    state: str | None = Query(None, min_length=2, max_length=2),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Get all generics/similars for a medication."""
    if not pool:
        raise HTTPException(503, "Database not configured")
    medication_id = _extract_id(slug)
    if not medication_id:
        raise HTTPException(status_code=404, detail="Medication not found")
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


def _extract_id(slug: str) -> int | None:
    """Extract numeric ID from slug like 'dipirona-11610' -> 11610."""
    import re
    # Try pure numeric
    if slug.isdigit():
        return int(slug)
    # Try trailing number after last hyphen
    match = re.search(r"-(\d+)$", slug)
    if match:
        return int(match.group(1))
    return None


def _slugify(text: str) -> str:
    """Simple slug generator for medication names."""
    import re
    import unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")
