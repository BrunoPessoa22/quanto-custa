from __future__ import annotations
import logging
import time

import asyncpg
from fastapi import APIRouter, Query, Depends, BackgroundTasks

from api.deps import get_db
from services.medication_db import search_medications

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/suggestions")
async def suggestions(
    q: str = Query(..., min_length=2, max_length=200),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Fast autocomplete suggestions while typing."""
    if not pool:
        return []

    rows = await pool.fetch(
        """
        SELECT DISTINCT ON (m.product_name)
            m.id, m.product_name, m.active_ingredient, m.category
        FROM medications m
        WHERE unaccent(lower(m.product_name)) ILIKE '%' || unaccent(lower($1)) || '%'
           OR unaccent(lower(m.active_ingredient)) ILIKE '%' || unaccent(lower($1)) || '%'
        ORDER BY m.product_name,
                 CASE WHEN unaccent(lower(m.product_name)) ILIKE unaccent(lower($1)) || '%' THEN 0 ELSE 1 END
        LIMIT 8
        """,
        q,
    )

    return [
        {
            "name": r["product_name"],
            "slug": f"{_slugify(r['product_name'])}-{r['id']}",
            "active_ingredient": r["active_ingredient"],
            "category": r["category"],
        }
        for r in rows
    ]


@router.get("")
async def search(
    q: str = Query(..., min_length=2, max_length=200, description="Search query"),
    estado: str | None = Query(None, min_length=2, max_length=2, description="Brazilian state (UF)"),
    limit: int = Query(20, ge=1, le=50),
    pool: asyncpg.Pool | None = Depends(get_db),
    background_tasks: BackgroundTasks = BackgroundTasks(),
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
        # Use reference, new, or similar as the price baseline (branded drugs)
        cat = med.get("category", "")
        if ingredient and price and cat in ("reference", "new", "similar", "specific", "biological"):
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

    # Warm pharmacy cache for top results in the background
    if raw_results:
        top_names = [r.get("product_name", "") for r in raw_results[:3] if r.get("product_name")]
        for name in top_names:
            background_tasks.add_task(_warm_pharmacy_cache, pool, name)

    return {
        "query": q,
        "state": estado,
        "total": len(medications),
        "medications": medications,
    }


async def _warm_pharmacy_cache(pool: asyncpg.Pool | None, query: str) -> None:
    """Background task: scrape pharmacy prices so they are cached for later."""
    if not pool:
        return
    try:
        from services.pharmacy_scraper import scrape_all_pharmacies
        import json
        from datetime import datetime, timezone

        normalized = query.strip().lower()

        # Skip if already cached (< 24h)
        existing = await pool.fetchval(
            """
            SELECT COUNT(*) FROM pharmacy_prices
            WHERE search_query = $1
              AND scraped_at > NOW() - INTERVAL '24 hours'
            """,
            normalized,
        )
        if existing and existing > 0:
            return

        scraped = await scrape_all_pharmacies(normalized)
        now = datetime.now(timezone.utc)
        for pharmacy_id, products in scraped.items():
            serialized = json.dumps(
                [{"name": p.name, "price": p.price, "url": p.url} for p in products],
                ensure_ascii=False,
            )
            await pool.execute(
                """
                INSERT INTO pharmacy_prices (search_query, pharmacy, results, scraped_at)
                VALUES ($1, $2, $3::jsonb, $4)
                ON CONFLICT (search_query, pharmacy)
                DO UPDATE SET results = EXCLUDED.results, scraped_at = EXCLUDED.scraped_at
                """,
                normalized,
                pharmacy_id,
                serialized,
                now,
            )
    except Exception:
        logger.warning("Background pharmacy cache warm failed for '%s'", query, exc_info=True)


def _slugify(text: str) -> str:
    """Simple slug generator for medication names."""
    import re
    import unicodedata
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")
