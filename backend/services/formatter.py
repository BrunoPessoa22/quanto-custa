from __future__ import annotations
from services.affiliate import generate_all_pharmacy_links
from services.medication_db import get_pmc_column


def format_medication_comparison(
    medication: dict,
    equivalents: list[dict],
    state: str | None = None,
    user_id: str | None = None,
) -> dict:
    """Format a medication with its equivalents for the frontend."""
    pmc_col = get_pmc_column(state)
    ref_price = medication.get("pmc_price") or medication.get(pmc_col)

    # Find cheapest equivalent
    cheapest = None
    if equivalents:
        priced = [e for e in equivalents if e.get("pmc_price")]
        if priced:
            cheapest = min(priced, key=lambda e: e["pmc_price"])

    savings_pct = None
    savings_amount = None
    if ref_price and cheapest and cheapest.get("pmc_price"):
        savings_amount = round(ref_price - cheapest["pmc_price"], 2)
        if ref_price > 0:
            savings_pct = round((savings_amount / ref_price) * 100, 1)

    search_name = medication.get("active_ingredient") or medication.get("product_name", "")
    pharmacy_links = generate_all_pharmacy_links(search_name, user_id)

    return {
        "medication": {
            "id": medication.get("id"),
            "product_name": medication.get("product_name"),
            "active_ingredient": medication.get("active_ingredient"),
            "manufacturer": medication.get("manufacturer"),
            "presentation": medication.get("presentation"),
            "category": medication.get("category"),
            "restriction": medication.get("restriction"),
            "pmc_price": ref_price,
            "farmacia_popular": {
                "eligible": medication.get("farmacia_popular_eligible", False),
                "free": medication.get("farmacia_popular_free", False),
            },
        },
        "cheapest_equivalent": _format_med_summary(cheapest) if cheapest else None,
        "savings": {
            "amount": savings_amount,
            "percentage": savings_pct,
        } if savings_amount else None,
        "equivalents": [_format_med_summary(e) for e in equivalents],
        "pharmacy_links": pharmacy_links,
        "state": state,
    }


def _format_med_summary(med: dict) -> dict:
    return {
        "id": med.get("id"),
        "product_name": med.get("product_name"),
        "manufacturer": med.get("manufacturer"),
        "presentation": med.get("presentation"),
        "category": med.get("category"),
        "pmc_price": med.get("pmc_price"),
        "equivalent_type": med.get("equivalent_type"),
    }
