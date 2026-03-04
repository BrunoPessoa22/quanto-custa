from __future__ import annotations
import logging

import asyncpg

logger = logging.getLogger(__name__)

# ICMS bracket mapping: state -> column suffix
STATE_ICMS_MAP: dict[str, str] = {
    # ICMS 0% - Zona Franca
    "AM": "pmc_icms_0", "AP": "pmc_icms_0", "RR": "pmc_icms_0",
    # ICMS 12%
    "MG": "pmc_icms_12", "PR": "pmc_icms_12", "SC": "pmc_icms_12",
    "RS": "pmc_icms_12", "RJ": "pmc_icms_12",
    # ICMS 17%
    "AC": "pmc_icms_17", "AL": "pmc_icms_17", "CE": "pmc_icms_17",
    "ES": "pmc_icms_17", "MA": "pmc_icms_17", "MT": "pmc_icms_17",
    "MS": "pmc_icms_17", "PA": "pmc_icms_17", "PB": "pmc_icms_17",
    "PE": "pmc_icms_17", "PI": "pmc_icms_17", "RN": "pmc_icms_17",
    "RO": "pmc_icms_17", "SE": "pmc_icms_17", "TO": "pmc_icms_17",
    "DF": "pmc_icms_17", "GO": "pmc_icms_17",
    # ICMS 18%
    "SP": "pmc_icms_18",
    # ICMS 19%
    "BA": "pmc_icms_19",
}

DEFAULT_PMC_COLUMN = "pmc_icms_20"

# Whitelist to prevent SQL injection
VALID_PMC_COLUMNS = {
    "pmc_icms_0", "pmc_icms_12", "pmc_icms_17",
    "pmc_icms_18", "pmc_icms_19", "pmc_icms_20",
}


def get_pmc_column(state: str | None) -> str:
    if not state:
        return DEFAULT_PMC_COLUMN
    col = STATE_ICMS_MAP.get(state.upper(), DEFAULT_PMC_COLUMN)
    return col if col in VALID_PMC_COLUMNS else DEFAULT_PMC_COLUMN


async def search_medications(
    pool: asyncpg.Pool,
    query: str,
    state: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """Fuzzy search medications using pg_trgm similarity."""
    pmc_col = get_pmc_column(state)

    sql = f"""
        SELECT
            m.id, m.product_name, m.active_ingredient, m.manufacturer,
            m.presentation, m.category, m.restriction,
            m.farmacia_popular_eligible, m.farmacia_popular_free,
            m.{pmc_col} AS pmc_price,
            GREATEST(
                similarity(unaccent(lower(m.product_name)), unaccent(lower($1))),
                similarity(unaccent(lower(m.active_ingredient)), unaccent(lower($1)))
            ) AS similarity_score
        FROM medications m
        WHERE
            unaccent(lower(m.product_name)) % unaccent(lower($1))
            OR unaccent(lower(m.active_ingredient)) % unaccent(lower($1))
            OR unaccent(lower(m.product_name)) ILIKE '%' || unaccent(lower($1)) || '%'
            OR unaccent(lower(m.active_ingredient)) ILIKE '%' || unaccent(lower($1)) || '%'
        ORDER BY similarity_score DESC
        LIMIT $2
    """

    rows = await pool.fetch(sql, query, limit)
    return [dict(r) for r in rows]


async def get_medication_by_id(
    pool: asyncpg.Pool,
    medication_id: int,
) -> dict | None:
    row = await pool.fetchrow("SELECT * FROM medications WHERE id = $1", medication_id)
    return dict(row) if row else None


async def get_medication_by_slug(
    pool: asyncpg.Pool,
    slug: str,
) -> dict | None:
    """Look up by slug. Slug ends with '-{id}', e.g. 'dipirona-500mg-123'."""
    parts = slug.rsplit("-", 1)
    if len(parts) != 2 or not parts[1].isdigit():
        return None
    return await get_medication_by_id(pool, int(parts[1]))


async def get_medication_with_equivalents(
    pool: asyncpg.Pool,
    medication_id: int,
    state: str | None = None,
) -> dict | None:
    """Get medication with all generic/similar equivalents."""
    med = await get_medication_by_id(pool, medication_id)
    if not med:
        return None

    pmc_col = get_pmc_column(state)
    med["pmc_price"] = med.get(pmc_col)

    equiv_sql = f"""
        SELECT m.*, de.equivalent_type,
               m.{pmc_col} AS pmc_price
        FROM drug_equivalents de
        JOIN medications m ON m.id = de.equivalent_medication_id
        WHERE de.reference_medication_id = $1
        ORDER BY m.{pmc_col} ASC NULLS LAST
    """
    equiv_rows = await pool.fetch(equiv_sql, medication_id)
    equivalents = [dict(r) for r in equiv_rows]

    ref_sql = f"""
        SELECT m.*, m.{pmc_col} AS pmc_price
        FROM drug_equivalents de
        JOIN medications m ON m.id = de.reference_medication_id
        WHERE de.equivalent_medication_id = $1
        LIMIT 1
    """
    ref_row = await pool.fetchrow(ref_sql, medication_id)
    reference_drug = dict(ref_row) if ref_row else None

    med["equivalents"] = equivalents
    med["reference_drug"] = reference_drug
    return med


async def get_cheapest_equivalent(
    pool: asyncpg.Pool,
    medication_id: int,
    state: str | None = None,
) -> dict | None:
    pmc_col = get_pmc_column(state)
    sql = f"""
        SELECT m.*, m.{pmc_col} AS pmc_price
        FROM drug_equivalents de
        JOIN medications m ON m.id = de.equivalent_medication_id
        WHERE de.reference_medication_id = $1
          AND m.{pmc_col} IS NOT NULL
        ORDER BY m.{pmc_col} ASC
        LIMIT 1
    """
    row = await pool.fetchrow(sql, medication_id)
    return dict(row) if row else None


async def get_farmacia_popular_drugs(
    pool: asyncpg.Pool,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    sql = """
        SELECT id, product_name, active_ingredient, manufacturer,
               presentation, category, farmacia_popular_free, pmc_icms_0
        FROM medications
        WHERE farmacia_popular_eligible = TRUE
        ORDER BY active_ingredient
        LIMIT $1 OFFSET $2
    """
    rows = await pool.fetch(sql, limit, offset)
    return [dict(r) for r in rows]


async def search_farmacia_popular(
    pool: asyncpg.Pool,
    query: str | None = None,
    free_only: bool = False,
    discounted_only: bool = False,
    state: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """Search medications eligible for Farmacia Popular.

    Supports optional text search across product_name and active_ingredient,
    free_only to restrict to 100% free, discounted_only for eligible-but-not-free.
    """
    pmc_col = get_pmc_column(state)

    conditions = ["m.farmacia_popular_eligible = TRUE"]
    params: list = []
    param_idx = 0

    if free_only:
        conditions.append("m.farmacia_popular_free = TRUE")
    elif discounted_only:
        conditions.append("m.farmacia_popular_free = FALSE")

    if query and query.strip():
        param_idx += 1
        conditions.append(
            f"(unaccent(lower(m.product_name)) ILIKE '%%' || unaccent(lower(${param_idx})) || '%%'"
            f" OR unaccent(lower(m.active_ingredient)) ILIKE '%%' || unaccent(lower(${param_idx})) || '%%')"
        )
        params.append(query.strip())

    param_idx += 1
    params.append(limit)
    limit_param = f"${param_idx}"

    param_idx += 1
    params.append(offset)
    offset_param = f"${param_idx}"

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT
            m.id, m.product_name, m.active_ingredient, m.manufacturer,
            m.presentation, m.category, m.restriction,
            m.farmacia_popular_eligible, m.farmacia_popular_free,
            m.{pmc_col} AS pmc_price
        FROM medications m
        WHERE {where_clause}
        ORDER BY m.active_ingredient, m.product_name
        LIMIT {limit_param} OFFSET {offset_param}
    """

    rows = await pool.fetch(sql, *params)
    return [dict(r) for r in rows]


async def get_farmacia_popular_stats(pool: asyncpg.Pool) -> dict:
    """Return aggregate counts for Farmacia Popular medications."""
    sql = """
        SELECT
            COUNT(*) FILTER (WHERE farmacia_popular_eligible = TRUE) AS total_eligible,
            COUNT(*) FILTER (WHERE farmacia_popular_free = TRUE) AS total_free,
            COUNT(*) FILTER (
                WHERE farmacia_popular_eligible = TRUE
                  AND farmacia_popular_free = FALSE
            ) AS total_discounted
        FROM medications
    """
    row = await pool.fetchrow(sql)
    return {
        "total_eligible": row["total_eligible"],
        "total_free": row["total_free"],
        "total_discounted": row["total_discounted"],
    }
