from __future__ import annotations
import logging

import asyncpg

from services.medication_db import (
    get_pmc_column,
    search_medications,
    VALID_PMC_COLUMNS,
)

logger = logging.getLogger(__name__)


async def match_prescription(
    pool: asyncpg.Pool,
    extracted_items: list[dict],
    state: str | None = None,
) -> dict:
    """Match extracted prescription items against the medication database.

    For each item:
      1. Fuzzy-search by product name
      2. Fuzzy-search by active ingredient (if extracted)
      3. Find generic alternatives for the best match
      4. Find Farmacia Popular options
      5. Calculate savings

    Returns aggregated results with per-item breakdown and a summary.
    """
    pmc_col = get_pmc_column(state)
    items: list[dict] = []

    total_reference_cost = 0.0
    total_cheapest_cost = 0.0
    farmacia_popular_count = 0
    farmacia_popular_free_count = 0

    for extracted in extracted_items:
        name = extracted.get("name", "").strip()
        active_ingredient = extracted.get("active_ingredient", "").strip()
        dosage = extracted.get("dosage", "")
        confidence = extracted.get("confidence", 0)

        if not name:
            continue

        # -- Step 1: search by product name --
        name_matches = await search_medications(pool, name, state, limit=10)

        # -- Step 2: search by active ingredient if we have one --
        ingredient_matches: list[dict] = []
        if active_ingredient:
            ingredient_matches = await search_medications(
                pool, active_ingredient, state, limit=10
            )

        # Merge and deduplicate, preferring highest similarity
        seen_ids: dict[int, dict] = {}
        for m in name_matches + ingredient_matches:
            mid = m["id"]
            if mid not in seen_ids or m.get("similarity_score", 0) > seen_ids[mid].get("similarity_score", 0):
                seen_ids[mid] = m
        all_matches = sorted(seen_ids.values(), key=lambda x: x.get("similarity_score", 0), reverse=True)

        # -- Pick the best match --
        best_match = _pick_best_match(all_matches, name, dosage)

        if not best_match:
            # No match found at all -- include the item but with empty results
            items.append({
                "extracted": {
                    "name": name,
                    "active_ingredient": active_ingredient,
                    "dosage": dosage,
                    "confidence": confidence,
                },
                "best_match": None,
                "generic_alternatives": [],
                "cheapest_option": None,
                "farmacia_popular_option": None,
                "savings": None,
            })
            continue

        # -- Step 3: find generic alternatives by active ingredient --
        best_ingredient = best_match.get("active_ingredient", "")
        generic_alternatives = await _find_generic_alternatives(
            pool, best_match["id"], best_ingredient, pmc_col
        )

        # -- Step 4: find Farmacia Popular option --
        fp_option = await _find_farmacia_popular_option(
            pool, best_ingredient, pmc_col
        )

        # -- Step 5: find the absolute cheapest (including generics and FP) --
        cheapest = _find_cheapest(best_match, generic_alternatives, fp_option)

        # -- Step 6: calculate savings --
        reference_price = _safe_price(best_match.get("pmc_price"))
        cheapest_price = _safe_price(cheapest.get("pmc_price")) if cheapest else reference_price

        # If the best match is already a generic, look for the reference (branded) price
        # to give a meaningful savings comparison
        if best_match.get("category") in ("generico", "similar"):
            ref_brand = _find_reference_brand(all_matches)
            if ref_brand:
                brand_price = _safe_price(ref_brand.get("pmc_price"))
                if brand_price and brand_price > reference_price:
                    reference_price = brand_price

        savings = _calculate_savings(reference_price, cheapest_price, fp_option)

        if reference_price:
            total_reference_cost += reference_price
        if cheapest_price:
            total_cheapest_cost += cheapest_price
        elif reference_price:
            total_cheapest_cost += reference_price

        if fp_option:
            farmacia_popular_count += 1
            if fp_option.get("farmacia_popular_free"):
                farmacia_popular_free_count += 1

        items.append({
            "extracted": {
                "name": name,
                "active_ingredient": active_ingredient,
                "dosage": dosage,
                "confidence": confidence,
            },
            "best_match": _serialize_medication(best_match),
            "generic_alternatives": [_serialize_medication(g) for g in generic_alternatives[:5]],
            "cheapest_option": _serialize_medication(cheapest) if cheapest else None,
            "farmacia_popular_option": _serialize_medication(fp_option) if fp_option else None,
            "savings": savings,
        })

    total_savings = total_reference_cost - total_cheapest_cost
    total_savings_pct = (
        round((total_savings / total_reference_cost) * 100, 1)
        if total_reference_cost > 0
        else 0.0
    )

    return {
        "items": items,
        "summary": {
            "total_reference_cost": round(total_reference_cost, 2),
            "total_cheapest_cost": round(total_cheapest_cost, 2),
            "total_savings": round(total_savings, 2),
            "total_savings_percentage": total_savings_pct,
            "farmacia_popular_count": farmacia_popular_count,
            "farmacia_popular_free_count": farmacia_popular_free_count,
        },
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _pick_best_match(
    candidates: list[dict],
    search_name: str,
    dosage: str,
) -> dict | None:
    """Pick the best match from candidates, preferring dosage overlap when possible."""
    if not candidates:
        return None

    if not dosage:
        return candidates[0]

    dosage_lower = dosage.lower()
    for c in candidates:
        presentation = (c.get("presentation") or "").lower()
        product_name = (c.get("product_name") or "").lower()
        if dosage_lower in presentation or dosage_lower in product_name:
            return c

    # No dosage match -- fall back to highest similarity
    return candidates[0]


async def _find_generic_alternatives(
    pool: asyncpg.Pool,
    medication_id: int,
    active_ingredient: str,
    pmc_col: str,
) -> list[dict]:
    """Find generics/similars sharing the same active ingredient."""
    if not active_ingredient:
        return []

    if pmc_col not in VALID_PMC_COLUMNS:
        pmc_col = "pmc_icms_20"

    sql = f"""
        SELECT
            m.id, m.product_name, m.active_ingredient, m.manufacturer,
            m.presentation, m.category, m.restriction,
            m.farmacia_popular_eligible, m.farmacia_popular_free,
            m.{pmc_col} AS pmc_price
        FROM medications m
        WHERE
            unaccent(lower(m.active_ingredient)) = unaccent(lower($1))
            AND m.id != $2
            AND m.{pmc_col} IS NOT NULL
        ORDER BY m.{pmc_col} ASC
        LIMIT 20
    """
    rows = await pool.fetch(sql, active_ingredient, medication_id)
    return [dict(r) for r in rows]


async def _find_farmacia_popular_option(
    pool: asyncpg.Pool,
    active_ingredient: str,
    pmc_col: str,
) -> dict | None:
    """Find the best Farmacia Popular option for a given active ingredient.

    Prefers free options first, then cheapest.
    """
    if not active_ingredient:
        return None

    if pmc_col not in VALID_PMC_COLUMNS:
        pmc_col = "pmc_icms_20"

    sql = f"""
        SELECT
            m.id, m.product_name, m.active_ingredient, m.manufacturer,
            m.presentation, m.category, m.restriction,
            m.farmacia_popular_eligible, m.farmacia_popular_free,
            m.{pmc_col} AS pmc_price
        FROM medications m
        WHERE
            m.farmacia_popular_eligible = TRUE
            AND unaccent(lower(m.active_ingredient)) = unaccent(lower($1))
        ORDER BY
            m.farmacia_popular_free DESC,
            m.{pmc_col} ASC NULLS LAST
        LIMIT 1
    """
    row = await pool.fetchrow(sql, active_ingredient)
    return dict(row) if row else None


def _find_cheapest(
    best_match: dict,
    generics: list[dict],
    fp_option: dict | None,
) -> dict | None:
    """Return the cheapest medication among best_match, its generics, and the FP option."""
    candidates = [best_match] + generics
    if fp_option:
        candidates.append(fp_option)

    cheapest = None
    cheapest_price = None
    for c in candidates:
        price = _safe_price(c.get("pmc_price"))
        if price is None:
            continue
        # Farmacia Popular free items have effective price 0
        if c.get("farmacia_popular_free"):
            return c
        if cheapest_price is None or price < cheapest_price:
            cheapest_price = price
            cheapest = c

    return cheapest


def _find_reference_brand(candidates: list[dict]) -> dict | None:
    """Find a reference (branded) drug among candidates to use as savings baseline."""
    for c in candidates:
        cat = (c.get("category") or "").lower()
        if cat in ("referencia", "referência", "reference"):
            return c
    return None


def _calculate_savings(
    reference_price: float | None,
    cheapest_price: float | None,
    fp_option: dict | None,
) -> dict | None:
    """Calculate savings between reference and cheapest price."""
    if reference_price is None or reference_price <= 0:
        return None

    if cheapest_price is None:
        cheapest_price = reference_price

    # If there is a free FP option, effective cheapest is 0
    if fp_option and fp_option.get("farmacia_popular_free"):
        cheapest_price = 0.0

    amount = reference_price - cheapest_price
    percentage = round((amount / reference_price) * 100, 1) if reference_price > 0 else 0.0

    return {
        "reference_price": round(reference_price, 2),
        "cheapest_price": round(cheapest_price, 2),
        "amount": round(amount, 2),
        "percentage": percentage,
    }


def _safe_price(value) -> float | None:
    """Safely convert a price value to float."""
    if value is None:
        return None
    try:
        price = float(value)
        return price if price > 0 else None
    except (ValueError, TypeError):
        return None


def _serialize_medication(med: dict) -> dict:
    """Return a clean, JSON-friendly representation of a medication record."""
    return {
        "id": med.get("id"),
        "product_name": med.get("product_name"),
        "active_ingredient": med.get("active_ingredient"),
        "manufacturer": med.get("manufacturer"),
        "presentation": med.get("presentation"),
        "category": med.get("category"),
        "pmc_price": _safe_price(med.get("pmc_price")),
        "farmacia_popular_eligible": med.get("farmacia_popular_eligible", False),
        "farmacia_popular_free": med.get("farmacia_popular_free", False),
    }
