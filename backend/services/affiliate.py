from __future__ import annotations
import logging
from urllib.parse import quote_plus

import asyncpg

from config import get_settings

logger = logging.getLogger(__name__)

# Base search URLs for pharmacies
PHARMACY_SEARCH_URLS = {
    "drogasil": "https://www.drogasil.com.br/search?w={query}",
    "droga_raia": "https://www.drogaraia.com.br/search?w={query}",
    "pague_menos": "https://www.paguemenos.com.br/busca?q={query}",
}

PHARMACY_PROGRAM_ID_MAP = {
    "drogasil": "AWIN_DROGASIL_PROGRAM_ID",
    "droga_raia": "AWIN_DROGA_RAIA_PROGRAM_ID",
    "pague_menos": "AWIN_PAGUE_MENOS_PROGRAM_ID",
}


def generate_affiliate_link(
    medication_name: str,
    pharmacy: str,
    user_id: str | None = None,
) -> str | None:
    """Generate an Awin affiliate tracking URL for a pharmacy search."""
    settings = get_settings()

    base_url_template = PHARMACY_SEARCH_URLS.get(pharmacy)
    if not base_url_template:
        return None

    program_attr = PHARMACY_PROGRAM_ID_MAP.get(pharmacy)
    if not program_attr:
        return None

    program_id = getattr(settings, program_attr, "")
    publisher_id = settings.AWIN_PUBLISHER_ID

    if not publisher_id or not program_id:
        return base_url_template.format(query=quote_plus(medication_name))

    destination = base_url_template.format(query=quote_plus(medication_name))

    clickref = user_id or "anonymous"
    affiliate_url = (
        f"https://www.awin1.com/cread.php"
        f"?awinmid={program_id}"
        f"&awinaffid={publisher_id}"
        f"&clickref={clickref}"
        f"&ued={quote_plus(destination)}"
    )
    return affiliate_url


def generate_all_pharmacy_links(
    medication_name: str,
    user_id: str | None = None,
) -> dict[str, str]:
    """Generate affiliate links for all pharmacies."""
    links = {}
    for pharmacy in PHARMACY_SEARCH_URLS:
        link = generate_affiliate_link(medication_name, pharmacy, user_id)
        if link:
            links[pharmacy] = link
    return links


async def track_click(
    pool: asyncpg.Pool,
    click_id: str | None,
    user_id: str | None,
    medication_id: int | None,
    pharmacy: str,
    affiliate_link: str,
) -> None:
    """Record an affiliate click."""
    await pool.execute(
        """INSERT INTO affiliate_clicks (click_id, user_id, medication_id, pharmacy, affiliate_link)
           VALUES ($1, $2, $3, $4, $5)""",
        click_id, user_id, medication_id, pharmacy, affiliate_link,
    )
