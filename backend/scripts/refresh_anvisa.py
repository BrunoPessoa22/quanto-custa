from __future__ import annotations
"""Monthly ANVISA CMED refresh script.

Usage:
    python -m scripts.refresh_anvisa [--file /path/to/cmed.xls]
"""

import argparse
import asyncio
import logging
import sys
import time

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))

import asyncpg
from config import get_settings
from services.anvisa_parser import (
    download_cmed,
    parse_cmed_file,
    transform_row,
    upsert_medications,
    build_drug_equivalents,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main(file_path: str | None = None):
    start = time.monotonic()
    settings = get_settings()

    if not settings.DATABASE_URL:
        logger.error("DATABASE_URL not set")
        sys.exit(1)

    # Download if no local file provided
    if not file_path:
        logger.info("No file provided, downloading latest CMED...")
        file_path = await download_cmed()

    logger.info("Parsing CMED file: %s", file_path)
    df = parse_cmed_file(file_path)
    logger.info("Rows in file: %d", len(df))

    # Transform rows
    records = []
    skipped = 0
    for _, row in df.iterrows():
        record = transform_row(row)
        if record:
            records.append(record)
        else:
            skipped += 1

    logger.info("Valid records: %d | Skipped: %d", len(records), skipped)

    # Connect to Neon
    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=2, max_size=5, ssl="require")

    try:
        stats = await upsert_medications(pool, records)
        logger.info("Upsert results: %s", stats)

        logger.info("Building drug equivalents...")
        equiv_count = await build_drug_equivalents(pool)
        logger.info("Equivalents created/updated: %d", equiv_count)
    finally:
        await pool.close()

    elapsed = round(time.monotonic() - start, 1)
    logger.info("CMED refresh complete in %.1fs", elapsed)

    return {
        "records_processed": len(records),
        "skipped": skipped,
        "upsert": stats,
        "equivalents": equiv_count,
        "elapsed_seconds": elapsed,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Refresh ANVISA CMED data")
    parser.add_argument("--file", type=str, help="Path to local CMED XLS file")
    args = parser.parse_args()

    result = asyncio.run(main(args.file))
    print("\nRefresh Summary:")
    for k, v in result.items():
        print(f"  {k}: {v}")
