from __future__ import annotations

import re
import unicodedata
from services.medication_db import get_pmc_column

# ICMS brackets per state for prices_by_state
ICMS_BRACKETS: dict[str, float] = {
    "AC": 19, "AL": 19, "AP": 18, "AM": 20, "BA": 20.5,
    "CE": 20, "DF": 20, "ES": 17, "GO": 19, "MA": 22,
    "MT": 17, "MS": 17, "MG": 18, "PA": 19, "PB": 20,
    "PR": 19.5, "PE": 20.5, "PI": 21, "RJ": 22, "RN": 18,
    "RS": 17, "RO": 19.5, "RR": 20, "SC": 17, "SP": 18,
    "SE": 19, "TO": 20,
}

# Maps ICMS rate to the corresponding pmc column
ICMS_TO_COLUMN: dict[float, str] = {
    0: "pmc_icms_0",
    12: "pmc_icms_12",
    17: "pmc_icms_17",
    18: "pmc_icms_18",
    19: "pmc_icms_19",
    20: "pmc_icms_20",
}


def _slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text.lower())
    return re.sub(r"[-\s]+", "-", text).strip("-")


def _closest_icms_col(rate: float) -> str:
    """Find the closest PMC column for an ICMS rate."""
    if rate <= 0:
        return "pmc_icms_0"
    if rate <= 12:
        return "pmc_icms_12"
    if rate <= 17:
        return "pmc_icms_17"
    if rate <= 18:
        return "pmc_icms_18"
    if rate <= 19.5:
        return "pmc_icms_19"
    return "pmc_icms_20"


def format_medication_comparison(
    medication: dict,
    equivalents: list[dict],
    state: str | None = None,
) -> dict:
    """Format a medication with its equivalents for the frontend.

    Returns the flat shape expected by the Next.js MedicationDetail type:
    { id, slug, name, active_ingredient, ..., prices_by_state, equivalents }
    """
    pmc_col = get_pmc_column(state)
    ref_price = medication.get("pmc_price") or medication.get(pmc_col)
    med_id = medication.get("id")
    product_name = medication.get("product_name", "")
    slug = f"{_slugify(product_name)}-{med_id}" if med_id else ""

    # Build prices_by_state from the medication's PMC columns
    prices_by_state = []
    for state_code, icms_rate in sorted(ICMS_BRACKETS.items()):
        col = _closest_icms_col(icms_rate)
        pmc = medication.get(col)
        if pmc is not None:
            prices_by_state.append({
                "state": state_code,
                "icms_rate": icms_rate,
                "pmc": round(float(pmc), 2),
            })

    # Format equivalents
    formatted_equivalents = []
    for e in equivalents:
        e_id = e.get("id")
        e_name = e.get("product_name", "")
        e_slug = f"{_slugify(e_name)}-{e_id}" if e_id else ""
        e_price = e.get("pmc_price") or 0
        savings_vs_ref = None
        savings_pct = None
        if ref_price and e_price and e_price < ref_price:
            savings_vs_ref = round(ref_price - e_price, 2)
            savings_pct = round((1 - e_price / ref_price) * 100, 1)

        formatted_equivalents.append({
            "id": str(e_id) if e_id else "",
            "slug": e_slug,
            "name": e_name,
            "active_ingredient": e.get("active_ingredient", ""),
            "manufacturer": e.get("manufacturer", ""),
            "presentation": e.get("presentation", ""),
            "category": e.get("category", ""),
            "ean": "",
            "registry": "",
            "farmacia_popular": e.get("farmacia_popular_eligible", False),
            "farmacia_popular_free": e.get("farmacia_popular_free", False),
            "price": e_price or 0,
            "savings_vs_reference": savings_vs_ref,
            "savings_percentage": savings_pct,
            "reference_price": ref_price,
        })

    return {
        "id": str(med_id) if med_id else "",
        "slug": slug,
        "name": product_name,
        "active_ingredient": medication.get("active_ingredient", ""),
        "manufacturer": medication.get("manufacturer", ""),
        "presentation": medication.get("presentation", ""),
        "category": medication.get("category", ""),
        "ean": medication.get("ean_code") or "",
        "registry": medication.get("anvisa_registry") or "",
        "farmacia_popular": medication.get("farmacia_popular_eligible", False),
        "farmacia_popular_free": medication.get("farmacia_popular_free", False),
        "prices_by_state": prices_by_state,
        "equivalents": formatted_equivalents,
    }
