from __future__ import annotations
import base64
import logging
import time

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from api.deps import get_db
from config import get_settings
from services.medication_db import search_medications

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vision", tags=["vision"])

EXTRACTION_PROMPT = """Analyze this image of a medication prescription, package, or receipt.
Extract ALL medications you can identify. For each one, provide:
- name: the medication/drug name
- dosage: dosage if visible (e.g. "500mg")
- quantity: quantity if visible (e.g. "20 comprimidos")

Return a JSON array. Example:
[{"name": "Dipirona Sodica", "dosage": "500mg", "quantity": "20 comprimidos"}]

If you cannot identify any medications, return an empty array [].
Be precise. Only include medications you are confident about.
Rate your overall confidence from 0 to 100."""

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    state: str | None = None,
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Extract medication names from an image and match against database."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported image type: {file.content_type}")

    image_data = await file.read()
    if len(image_data) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image too large (max 10MB)")

    start = time.monotonic()
    settings = get_settings()

    extracted = None
    model_used = None
    confidence = 0

    if settings.ANTHROPIC_API_KEY:
        extracted, confidence = await _extract_with_claude(
            image_data, file.content_type, settings.ANTHROPIC_API_KEY
        )
        model_used = "claude"

    if (not extracted or confidence < 80) and settings.OPENAI_API_KEY:
        gpt_extracted, gpt_confidence = await _extract_with_gpt4o(
            image_data, file.content_type, settings.OPENAI_API_KEY
        )
        if gpt_confidence > confidence:
            extracted = gpt_extracted
            confidence = gpt_confidence
            model_used = "gpt4o"

    if not extracted or not pool:
        return {
            "medications_found": [],
            "model_used": model_used,
            "confidence": confidence,
            "response_time_ms": int((time.monotonic() - start) * 1000),
        }

    results = []
    for med_info in extracted:
        name = med_info.get("name", "")
        if not name:
            continue

        matches = await search_medications(pool, name, state, limit=5)
        results.append({
            "extracted": med_info,
            "matches": [
                {
                    "id": m.get("id"),
                    "product_name": m.get("product_name"),
                    "active_ingredient": m.get("active_ingredient"),
                    "presentation": m.get("presentation"),
                    "category": m.get("category"),
                    "pmc_price": m.get("pmc_price"),
                    "farmacia_popular_eligible": m.get("farmacia_popular_eligible", False),
                    "similarity_score": m.get("similarity_score"),
                }
                for m in matches
            ],
        })

    elapsed_ms = int((time.monotonic() - start) * 1000)

    return {
        "medications_found": results,
        "model_used": model_used,
        "confidence": confidence,
        "response_time_ms": elapsed_ms,
    }


async def _extract_with_claude(
    image_data: bytes,
    content_type: str,
    api_key: str,
) -> tuple[list[dict] | None, float]:
    import anthropic
    try:
        client = anthropic.Anthropic(api_key=api_key)
        b64 = base64.b64encode(image_data).decode()

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": content_type, "data": b64},
                    },
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }],
        )
        return _parse_extraction_response(response.content[0].text)
    except Exception:
        logger.exception("Claude Vision extraction failed")
        return None, 0


async def _extract_with_gpt4o(
    image_data: bytes,
    content_type: str,
    api_key: str,
) -> tuple[list[dict] | None, float]:
    import openai
    try:
        client = openai.OpenAI(api_key=api_key)
        b64 = base64.b64encode(image_data).decode()

        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}},
                    {"type": "text", "text": EXTRACTION_PROMPT},
                ],
            }],
        )
        return _parse_extraction_response(response.choices[0].message.content)
    except Exception:
        logger.exception("GPT-4o Vision extraction failed")
        return None, 0


def _parse_extraction_response(text: str) -> tuple[list[dict] | None, float]:
    import json

    confidence = 0
    medications = None

    lower = text.lower()
    for marker in ["confidence:", "confidence :", "confidence="]:
        if marker in lower:
            idx = lower.index(marker) + len(marker)
            num_str = ""
            for ch in text[idx:idx + 5]:
                if ch.isdigit() or ch == ".":
                    num_str += ch
                elif num_str:
                    break
            if num_str:
                try:
                    confidence = float(num_str)
                except ValueError:
                    pass
            break

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1:
        try:
            medications = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            logger.warning("Failed to parse medication JSON from LLM response")

    return medications, confidence
