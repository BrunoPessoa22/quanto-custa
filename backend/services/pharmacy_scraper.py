from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, asdict

import httpx
from selectolax.parser import HTMLParser

logger = logging.getLogger(__name__)


@dataclass
class PharmacyProduct:
    name: str
    price: float
    url: str


_semaphore = asyncio.Semaphore(2)

PHARMACIES = {
    "drogasil": {
        "search_url": "https://www.drogasil.com.br/search?w={}",
        "name": "Drogasil",
    },
    "drogaraia": {
        "search_url": "https://www.drogaraia.com.br/search?w={}",
        "name": "Droga Raia",
    },
    "paguemenos": {
        "search_url": "https://www.paguemenos.com.br/busca?q={}",
        "name": "Pague Menos",
    },
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

# Common price regex: matches R$ 1.234,56 or 1234.56 or 12,34
_PRICE_RE = re.compile(
    r"R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})"
)


def _parse_br_price(text: str) -> float | None:
    """Parse a Brazilian-format price string like '4.299,90' or '12,50' to float."""
    try:
        cleaned = text.replace(".", "").replace(",", ".")
        value = float(cleaned)
        if 0 < value < 50_000:
            return round(value, 2)
    except (ValueError, TypeError):
        pass
    return None


def _extract_json_ld_products(html: str) -> list[PharmacyProduct]:
    """Extract products from JSON-LD structured data blocks."""
    products: list[PharmacyProduct] = []
    tree = HTMLParser(html)

    for script_node in tree.css('script[type="application/ld+json"]'):
        raw = script_node.text(strip=True)
        if not raw:
            continue
        try:
            data = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            continue

        items = _collect_products_from_jsonld(data)
        for item in items:
            name = item.get("name", "").strip()
            url = item.get("url", "")
            price = _extract_price_from_jsonld_item(item)
            if name and price:
                products.append(PharmacyProduct(name=name, price=price, url=url))

    return products


def _collect_products_from_jsonld(data: dict | list) -> list[dict]:
    """Recursively collect Product-type entries from JSON-LD."""
    items: list[dict] = []
    if isinstance(data, list):
        for entry in data:
            items.extend(_collect_products_from_jsonld(entry))
        return items

    if not isinstance(data, dict):
        return items

    obj_type = data.get("@type", "")
    if obj_type == "Product":
        items.append(data)
    elif obj_type == "ItemList":
        for element in data.get("itemListElement", []):
            if isinstance(element, dict):
                inner = element.get("item", element)
                items.extend(_collect_products_from_jsonld(inner))

    return items


def _extract_price_from_jsonld_item(item: dict) -> float | None:
    """Pull the numeric price from a JSON-LD Product entry."""
    offers = item.get("offers", {})
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if not isinstance(offers, dict):
        return None

    # Try direct numeric 'price' field
    raw_price = offers.get("price") or offers.get("lowPrice")
    if raw_price is not None:
        try:
            value = float(raw_price)
            if 0 < value < 50_000:
                return round(value, 2)
        except (ValueError, TypeError):
            pass

    # Try 'priceCurrency' formatted string
    price_str = str(offers.get("price", ""))
    parsed = _parse_br_price(price_str)
    if parsed:
        return parsed

    return None


def _extract_html_prices(html: str, base_url: str) -> list[PharmacyProduct]:
    """Fallback: extract products from common e-commerce HTML patterns."""
    products: list[PharmacyProduct] = []
    tree = HTMLParser(html)

    # Common product card selectors used across Brazilian pharmacies
    card_selectors = [
        "[data-product-name]",
        ".product-card",
        ".product-item",
        ".product-grid-item",
        ".shelf-item",
        'li[class*="product"]',
        'div[class*="ProductCard"]',
        'article[class*="product"]',
    ]

    for selector in card_selectors:
        cards = tree.css(selector)
        if not cards:
            continue

        for card in cards[:10]:  # Limit to first 10 results
            product = _parse_product_card(card, base_url)
            if product:
                products.append(product)

        if products:
            break  # Found products with this selector, stop trying others

    return products


def _parse_product_card(card, base_url: str) -> PharmacyProduct | None:
    """Extract name, price, and URL from a single product card node."""
    # Try data attributes first
    name = card.attributes.get("data-product-name", "")

    # If no data attribute, look for heading or link text
    if not name:
        for sel in ["h2", "h3", ".product-name", "a[class*='name']", "a[class*='title']"]:
            node = card.css_first(sel)
            if node:
                name = node.text(strip=True)
                break

    if not name:
        return None

    # Extract price
    price: float | None = None
    price_attr = card.attributes.get("data-product-price")
    if price_attr:
        try:
            price = round(float(price_attr), 2)
        except (ValueError, TypeError):
            pass

    if not price:
        # Look for price in text content
        for sel in [
            ".product-price",
            ".price",
            'span[class*="price"]',
            'span[class*="Price"]',
            'div[class*="price"]',
            ".sale-price",
            ".best-price",
        ]:
            node = card.css_first(sel)
            if node:
                text = node.text(strip=True)
                match = _PRICE_RE.search(text)
                if match:
                    price = _parse_br_price(match.group(1))
                    if price:
                        break

    if not price:
        # Broad search in the whole card text
        card_text = card.text()
        match = _PRICE_RE.search(card_text)
        if match:
            price = _parse_br_price(match.group(1))

    if not price:
        return None

    # Extract URL
    url = ""
    link = card.css_first("a[href]")
    if link:
        href = link.attributes.get("href", "")
        if href.startswith("/"):
            url = base_url.rstrip("/") + href
        elif href.startswith("http"):
            url = href

    return PharmacyProduct(name=name, price=price, url=url)


async def scrape_pharmacy_prices(
    query: str, pharmacy: str
) -> list[PharmacyProduct]:
    """Scrape a single pharmacy for product prices matching the query.

    Returns an empty list on any error -- never raises.
    """
    config = PHARMACIES.get(pharmacy)
    if not config:
        return []

    search_url = config["search_url"].format(query)
    base_url = search_url.split("/search")[0].split("/busca")[0]

    async with _semaphore:
        try:
            async with httpx.AsyncClient(
                headers=HEADERS,
                follow_redirects=True,
                timeout=httpx.Timeout(5.0),
            ) as client:
                resp = await client.get(search_url)
                resp.raise_for_status()
                html = resp.text
        except Exception:
            logger.warning("Failed to fetch %s for query '%s'", pharmacy, query, exc_info=True)
            return []

    # Strategy 1: JSON-LD structured data
    try:
        products = _extract_json_ld_products(html)
        if products:
            logger.info(
                "Found %d products via JSON-LD from %s for '%s'",
                len(products), pharmacy, query,
            )
            return products[:10]
    except Exception:
        logger.debug("JSON-LD parsing failed for %s", pharmacy, exc_info=True)

    # Strategy 2: HTML pattern matching
    try:
        products = _extract_html_prices(html, base_url)
        if products:
            logger.info(
                "Found %d products via HTML parsing from %s for '%s'",
                len(products), pharmacy, query,
            )
            return products[:10]
    except Exception:
        logger.debug("HTML parsing failed for %s", pharmacy, exc_info=True)

    logger.info("No products found from %s for '%s'", pharmacy, query)
    return []


async def scrape_all_pharmacies(
    query: str,
) -> dict[str, list[PharmacyProduct]]:
    """Scrape all configured pharmacies concurrently.

    Returns a dict keyed by pharmacy id, each value a list of PharmacyProduct.
    """
    tasks = {
        pharmacy_id: scrape_pharmacy_prices(query, pharmacy_id)
        for pharmacy_id in PHARMACIES
    }

    results = await asyncio.gather(*tasks.values(), return_exceptions=True)

    output: dict[str, list[PharmacyProduct]] = {}
    for pharmacy_id, result in zip(tasks.keys(), results):
        if isinstance(result, Exception):
            logger.warning(
                "Scrape failed for %s: %s", pharmacy_id, result,
            )
            output[pharmacy_id] = []
        else:
            output[pharmacy_id] = result

    return output
