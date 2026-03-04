from __future__ import annotations
import logging
import time

import asyncpg
from fastapi import APIRouter, Depends, BackgroundTasks

from api.deps import get_db
from services.anvisa_parser import (
    download_cmed,
    parse_cmed_file,
    transform_row,
    upsert_medications,
    build_drug_equivalents,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin", tags=["admin"])

_refresh_status: dict = {"running": False, "last_result": None}


async def _run_refresh(pool: asyncpg.Pool):
    global _refresh_status
    _refresh_status["running"] = True
    start = time.monotonic()
    try:
        file_path = await download_cmed()
        df = parse_cmed_file(file_path)
        logger.info("Parsed %d rows", len(df))

        records = []
        skipped = 0
        for _, row in df.iterrows():
            rec = transform_row(row)
            if rec:
                records.append(rec)
            else:
                skipped += 1

        logger.info("Valid: %d, Skipped: %d", len(records), skipped)
        stats = await upsert_medications(pool, records)
        logger.info("Upsert: %s", stats)

        equiv = await build_drug_equivalents(pool)
        elapsed = round(time.monotonic() - start, 1)
        _refresh_status["last_result"] = {
            "records": len(records),
            "skipped": skipped,
            "upsert": stats,
            "equivalents": equiv,
            "elapsed_seconds": elapsed,
        }
        logger.info("CMED refresh done in %.1fs", elapsed)
    except Exception:
        logger.exception("CMED refresh failed")
        _refresh_status["last_result"] = {"error": "refresh failed"}
    finally:
        _refresh_status["running"] = False


@router.post("/run-migration")
async def run_migration(
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Run pending schema migrations."""
    if not pool:
        return {"error": "Database not available"}

    migrations = [
        # Unique partial index needed for ON CONFLICT upsert
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_medications_ean_unique ON medications (ean_code) WHERE ean_code IS NOT NULL",
        # Drop the old non-unique index if it exists
        "DROP INDEX IF EXISTS idx_medications_ean",
        # Pharmacy prices cache table
        """CREATE TABLE IF NOT EXISTS pharmacy_prices (
            id BIGSERIAL PRIMARY KEY,
            search_query TEXT NOT NULL,
            pharmacy TEXT NOT NULL,
            results JSONB NOT NULL DEFAULT '[]',
            scraped_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (search_query, pharmacy)
        )""",
        "CREATE INDEX IF NOT EXISTS idx_pharmacy_prices_query ON pharmacy_prices (search_query)",
    ]
    results = []
    async with pool.acquire() as conn:
        for sql in migrations:
            try:
                await conn.execute(sql)
                results.append({"sql": sql[:60], "status": "ok"})
            except Exception as e:
                results.append({"sql": sql[:60], "status": f"error: {e}"})
    return {"migrations": results}


@router.post("/refresh-cmed")
async def refresh_cmed(
    background_tasks: BackgroundTasks,
    pool: asyncpg.Pool | None = Depends(get_db),
):
    if not pool:
        return {"error": "Database not available"}
    if _refresh_status["running"]:
        return {"status": "already_running"}

    background_tasks.add_task(_run_refresh, pool)
    return {"status": "started"}


@router.get("/refresh-status")
async def refresh_status():
    return _refresh_status


@router.post("/refresh-farmacia-popular-locations")
async def refresh_farmacia_popular_locations(
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Refresh Farmacia Popular pharmacy location data.

    TODO: Fetch from https://infoms.saude.gov.br/ when API is available.
    """
    if not pool:
        return {"error": "Database not available"}
    return {
        "status": "endpoint_ready",
        "message": "Location data source pending configuration",
    }
