from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import asyncpg
from fastapi import APIRouter, Depends, Query

from api.deps import get_db
from services.pharmacy_scraper import (
    PHARMACIES,
    PharmacyProduct,
    scrape_all_pharmacies,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pharmacy-prices", tags=["pharmacy-prices"])


@router.get("")
async def get_pharmacy_prices(
    q: str = Query(..., min_length=2, max_length=200, description="Search query"),
    medication_id: int | None = Query(None, description="Medication ID for PMC ceiling lookup"),
    estado: str | None = Query(None, min_length=2, max_length=2, description="State (UF) for PMC price"),
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Return pharmacy prices for a given search query.

    Uses a 24h cache backed by the pharmacy_prices table. On cache miss,
    scrapes pharmacies in the foreground and stores results for next time.
    """
    if not pool:
        return _empty_response(q)

    normalized_query = q.strip().lower()

    # -- Step 1: Check cache (< 24h old) --
    cached = await _load_cache(pool, normalized_query)

    if cached:
        prices = _format_cached(cached)
    else:
        # -- Step 2: Scrape live --
        try:
            scraped = await scrape_all_pharmacies(normalized_query)
        except Exception:
            logger.exception("scrape_all_pharmacies failed for '%s'", normalized_query)
            scraped = {}

        now = datetime.now(timezone.utc)
        prices = {}
        for pharmacy_id, pharmacy_cfg in PHARMACIES.items():
            products = scraped.get(pharmacy_id, [])
            serialized = [
                {"name": p.name, "price": p.price, "url": p.url}
                for p in products
            ]

            # Persist to cache (upsert)
            await _save_cache(pool, normalized_query, pharmacy_id, serialized, now)

            cheapest = min((p.price for p in products), default=None)
            prices[pharmacy_id] = {
                "name": pharmacy_cfg["name"],
                "products": serialized,
                "cheapest": cheapest,
                "scraped_at": now.isoformat(),
            }

    # -- Step 3: PMC ceiling price --
    pmc_ceiling = None
    if medication_id and estado:
        pmc_ceiling = await _get_pmc_ceiling(pool, medication_id, estado)

    return {
        "query": q,
        "prices": prices,
        "pmc_ceiling": pmc_ceiling,
    }


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

async def _load_cache(
    pool: asyncpg.Pool, query: str
) -> list[asyncpg.Record] | None:
    """Load cached pharmacy results that are less than 24h old."""
    rows = await pool.fetch(
        """
        SELECT pharmacy, results, scraped_at
        FROM pharmacy_prices
        WHERE search_query = $1
          AND scraped_at > NOW() - INTERVAL '24 hours'
        """,
        query,
    )
    return rows if rows else None


def _format_cached(rows: list[asyncpg.Record]) -> dict:
    """Format cached DB rows into the API response shape."""
    prices: dict = {}
    for row in rows:
        pharmacy_id = row["pharmacy"]
        pharmacy_cfg = PHARMACIES.get(pharmacy_id)
        if not pharmacy_cfg:
            continue

        results = row["results"]
        if isinstance(results, str):
            results = json.loads(results)

        products = results if isinstance(results, list) else []
        product_prices = [p.get("price") for p in products if p.get("price")]
        cheapest = min(product_prices) if product_prices else None

        prices[pharmacy_id] = {
            "name": pharmacy_cfg["name"],
            "products": products,
            "cheapest": cheapest,
            "scraped_at": row["scraped_at"].isoformat() if row["scraped_at"] else None,
        }
    return prices


async def _save_cache(
    pool: asyncpg.Pool,
    query: str,
    pharmacy: str,
    results: list[dict],
    scraped_at: datetime,
) -> None:
    """Upsert scraped results into pharmacy_prices."""
    try:
        await pool.execute(
            """
            INSERT INTO pharmacy_prices (search_query, pharmacy, results, scraped_at)
            VALUES ($1, $2, $3::jsonb, $4)
            ON CONFLICT (search_query, pharmacy)
            DO UPDATE SET results = EXCLUDED.results, scraped_at = EXCLUDED.scraped_at
            """,
            query,
            pharmacy,
            json.dumps(results, ensure_ascii=False),
            scraped_at,
        )
    except Exception:
        logger.warning("Failed to cache pharmacy prices for %s/%s", query, pharmacy, exc_info=True)


async def _get_pmc_ceiling(
    pool: asyncpg.Pool, medication_id: int, state: str
) -> float | None:
    """Look up the PMC ceiling price for a medication in a given state."""
    from services.medication_db import get_pmc_column

    pmc_col = get_pmc_column(state)
    row = await pool.fetchrow(
        f"SELECT {pmc_col} AS pmc_price FROM medications WHERE id = $1",
        medication_id,
    )
    if row and row["pmc_price"] is not None:
        return float(row["pmc_price"])
    return None


def _empty_response(query: str) -> dict:
    return {
        "query": query,
        "prices": {},
        "pmc_ceiling": None,
    }
