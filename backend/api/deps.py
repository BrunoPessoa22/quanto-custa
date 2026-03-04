from __future__ import annotations
import logging

import asyncpg

from config import get_settings

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    """Create the connection pool on startup."""
    global _pool
    settings = get_settings()
    if not settings.DATABASE_URL:
        logger.warning("DATABASE_URL not set - database unavailable")
        return
    _pool = await asyncpg.create_pool(
        settings.DATABASE_URL,
        min_size=2,
        max_size=10,
        ssl="require",
    )
    logger.info("Database pool created")


async def close_pool() -> None:
    """Close the connection pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


async def get_db() -> asyncpg.Pool | None:
    """FastAPI dependency that returns the connection pool."""
    return _pool
