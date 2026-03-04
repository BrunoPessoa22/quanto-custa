from __future__ import annotations
import logging
import time

import asyncpg
from fastapi import APIRouter, Query, Depends

from api.deps import get_db
from services.medication_db import search_medications

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
async def search(
    q: str = Query(..., min_length=2, max_length=200, description="Search query"),
    estado: str | None = Query(None, min_length=2, max_length=2, description="Brazilian state (UF)"),
    limit: int = Query(20, ge=1, le=50),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Fuzzy medication search with state-based PMC pricing."""
    if not pool:
        return {"query": q, "state": estado, "total": 0, "medications": []}

    start = time.monotonic()
    raw_results = await search_medications(pool, q, estado, limit)

    # Find reference prices by active ingredient for savings calculation
    ref_prices: dict[str, float] = {}
    for med in raw_results:
        ingredient = (med.get("active_ingredient") or "").strip().lower()
        price = med.get("pmc_price")
        if ingredient and price and med.get("category") == "reference":
            if ingredient not in ref_prices or price > ref_prices[ingredient]:
                ref_prices[ingredient] = price

    medications = []
    for med in raw_results:
        price = med.get("pmc_price")
        ingredient = (med.get("active_ingredient") or "").strip().lower()
        ref_price = ref_prices.get(ingredient)

        savings_vs_reference = None
        savings_percentage = None
        if price and ref_price and price < ref_price:
            savings_vs_reference = round(ref_price - price, 2)
            savings_percentage = round((1 - price / ref_price) * 100, 1)

        name = med.get("product_name", "")
        med_id = med.get("id")
        slug = f"{_slugify(name)}-{med_id}" if med_id else ""

        medications.append({
            "id": str(med_id) if med_id else "",
            "slug": slug,
            "name": name,
            "active_ingredient": med.get("active_ingredient", ""),
            "manufacturer": med.get("manufacturer", ""),
            "presentation": med.get("presentation", ""),
            "category": med.get("category", ""),
            "ean": "",
            "registry": "",
            "farmacia_popular": med.get("farmacia_popular_eligible", False),
            "farmacia_popular_free": med.get("farmacia_popular_free", False),
            "price": price or 0,
            "savings_vs_reference": savings_vs_reference,
            "savings_percentage": savings_percentage,
            "reference_price": ref_price,
        })

    elapsed_ms = int((time.monotonic() - start) * 1000)

    return {
        "query": q,
        "state": estado,
        "total": len(medications),
        "medications": medications,
    }


def _slugify(text: str) -> str:
    """Simple slug generator for medication names."""
    import re
    import unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")
