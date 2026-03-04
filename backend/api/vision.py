from __future__ import annotations
import base64
import json
import logging
import time

import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from api.deps import get_db
from config import get_settings
from services.medication_db import search_medications
from services.prescription_matcher import match_prescription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/vision", tags=["vision"])

# ---------------------------------------------------------------------------
# Structured extraction prompt -- Brazilian-specific, returns JSON
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT = """Voce e um assistente especializado em leitura de receitas medicas e embalagens de medicamentos brasileiros.

Analise esta imagem e identifique TODOS os medicamentos visiveis. A imagem pode ser:
- Uma receita medica (simples ou de controle especial)
- Uma embalagem de medicamento
- Um cupom fiscal de farmacia

Para cada medicamento identificado, extraia:
- name: nome comercial do medicamento (ex: "Amoxicilina", "Losartana Potassica")
- active_ingredient: principio ativo se visivel ou se voce souber (ex: "amoxicilina tri-hidratada")
- dosage: dosagem/concentracao (ex: "500mg", "50mg/ml")
- form: forma farmaceutica (ex: "comprimido", "capsula", "solucao oral", "pomada")
- quantity: quantidade prescrita ou na embalagem (ex: "21 comprimidos", "1 caixa")
- frequency: posologia se prescrita (ex: "1 comprimido a cada 8 horas")
- duration: duracao do tratamento se indicada (ex: "7 dias", "uso continuo")
- confidence: sua confianca de 0 a 100 na identificacao deste medicamento

Alem dos medicamentos, identifique:
- type: tipo do documento ("simples", "controle_especial", "embalagem", "cupom_fiscal")
- prescriber: nome do medico prescritor se visivel
- date: data da receita/documento se visivel (formato YYYY-MM-DD se possivel)

Retorne SOMENTE um JSON valido no seguinte formato (sem texto adicional antes ou depois):
{
  "type": "simples",
  "prescriber": "Dr. Joao Silva",
  "date": "2026-01-15",
  "medications": [
    {
      "name": "Amoxicilina",
      "active_ingredient": "amoxicilina tri-hidratada",
      "dosage": "500mg",
      "form": "capsula",
      "quantity": "21 capsulas",
      "frequency": "1 capsula a cada 8 horas",
      "duration": "7 dias",
      "confidence": 95
    }
  ],
  "overall_confidence": 90
}

Se nao conseguir identificar nenhum medicamento, retorne:
{"type": null, "prescriber": null, "date": null, "medications": [], "overall_confidence": 0}

Seja preciso. Inclua apenas medicamentos que voce consiga identificar com razoavel certeza."""

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/analyze")
async def analyze_image(
    file: UploadFile = File(...),
    state: str | None = None,
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Extract medication names from an image, match against the database,
    and return a full savings analysis."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported image type: {file.content_type}")

    image_data = await file.read()
    if len(image_data) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image too large (max 10MB)")

    start = time.monotonic()
    settings = get_settings()

    extraction: dict | None = None
    model_used: str | None = None
    overall_confidence: float = 0

    # Try Claude first
    if settings.ANTHROPIC_API_KEY:
        extraction, overall_confidence = await _extract_with_claude(
            image_data, file.content_type, settings.ANTHROPIC_API_KEY
        )
        model_used = "claude"

    # Fall back to GPT-4o if Claude failed or low confidence
    if (not extraction or overall_confidence < 80) and settings.OPENAI_API_KEY:
        gpt_extraction, gpt_confidence = await _extract_with_gpt4o(
            image_data, file.content_type, settings.OPENAI_API_KEY
        )
        if gpt_confidence > overall_confidence:
            extraction = gpt_extraction
            overall_confidence = gpt_confidence
            model_used = "gpt4o"

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # No extraction or no DB -- return minimal response
    if not extraction:
        return {
            "prescription": None,
            "items": [],
            "summary": _empty_summary(),
            "model_used": model_used,
            "overall_confidence": overall_confidence,
            "response_time_ms": elapsed_ms,
        }

    medications = extraction.get("medications", [])

    if not medications or not pool:
        return {
            "prescription": _extract_prescription_meta(extraction),
            "items": [],
            "summary": _empty_summary(),
            "model_used": model_used,
            "overall_confidence": overall_confidence,
            "response_time_ms": int((time.monotonic() - start) * 1000),
        }

    # Run the prescription matcher for full savings analysis
    match_result = await match_prescription(pool, medications, state)

    elapsed_ms = int((time.monotonic() - start) * 1000)

    return {
        "prescription": _extract_prescription_meta(extraction),
        "items": match_result["items"],
        "summary": match_result["summary"],
        "model_used": model_used,
        "overall_confidence": overall_confidence,
        "response_time_ms": elapsed_ms,
    }


# ---------------------------------------------------------------------------
# Vision extraction -- Claude
# ---------------------------------------------------------------------------

async def _extract_with_claude(
    image_data: bytes,
    content_type: str,
    api_key: str,
) -> tuple[dict | None, float]:
    import anthropic
    try:
        client = anthropic.Anthropic(api_key=api_key)
        b64 = base64.b64encode(image_data).decode()

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2048,
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


# ---------------------------------------------------------------------------
# Vision extraction -- GPT-4o
# ---------------------------------------------------------------------------

async def _extract_with_gpt4o(
    image_data: bytes,
    content_type: str,
    api_key: str,
) -> tuple[dict | None, float]:
    import openai
    try:
        client = openai.OpenAI(api_key=api_key)
        b64 = base64.b64encode(image_data).decode()

        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=2048,
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


# ---------------------------------------------------------------------------
# Response parsing (handles both new structured format and legacy array)
# ---------------------------------------------------------------------------

def _parse_extraction_response(text: str) -> tuple[dict | None, float]:
    """Parse the LLM extraction response.

    Supports two formats:
      - New structured format: a JSON object with "medications", "type", etc.
      - Legacy format: a bare JSON array of medications + optional confidence text

    Returns (extraction_dict, overall_confidence).
    """
    confidence: float = 0
    extraction: dict | None = None

    # Strip markdown code fences if the model wrapped the output
    cleaned = text.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = cleaned.find("\n")
        if first_newline != -1:
            cleaned = cleaned[first_newline + 1:]
        # Remove closing fence
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3].rstrip()

    # Attempt 1: parse as a full JSON object (new structured format)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict) and "medications" in parsed:
            confidence = float(parsed.get("overall_confidence", 0))
            return parsed, confidence
    except (json.JSONDecodeError, ValueError):
        pass

    # Attempt 2: find a JSON object in the text
    obj_start = cleaned.find("{")
    obj_end = cleaned.rfind("}")
    if obj_start != -1 and obj_end != -1 and obj_end > obj_start:
        try:
            parsed = json.loads(cleaned[obj_start : obj_end + 1])
            if isinstance(parsed, dict) and "medications" in parsed:
                confidence = float(parsed.get("overall_confidence", 0))
                return parsed, confidence
        except (json.JSONDecodeError, ValueError):
            pass

    # Attempt 3: legacy format -- bare JSON array
    arr_start = cleaned.find("[")
    arr_end = cleaned.rfind("]")
    if arr_start != -1 and arr_end != -1 and arr_end > arr_start:
        try:
            medications = json.loads(cleaned[arr_start : arr_end + 1])
            if isinstance(medications, list):
                # Try to extract confidence from surrounding text
                confidence = _extract_confidence_from_text(text)
                extraction = {
                    "type": None,
                    "prescriber": None,
                    "date": None,
                    "medications": medications,
                    "overall_confidence": confidence,
                }
                return extraction, confidence
        except json.JSONDecodeError:
            pass

    logger.warning("Failed to parse medication JSON from LLM response")
    return None, 0


def _extract_confidence_from_text(text: str) -> float:
    """Pull a confidence number from free-form text (legacy format fallback)."""
    lower = text.lower()
    for marker in ("confidence:", "confidence :", "confidence="):
        if marker in lower:
            idx = lower.index(marker) + len(marker)
            num_str = ""
            for ch in text[idx : idx + 5]:
                if ch.isdigit() or ch == ".":
                    num_str += ch
                elif num_str:
                    break
            if num_str:
                try:
                    return float(num_str)
                except ValueError:
                    pass
    return 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_prescription_meta(extraction: dict) -> dict:
    """Pull prescription-level metadata from the extraction result."""
    return {
        "type": extraction.get("type"),
        "prescriber": extraction.get("prescriber"),
        "date": extraction.get("date"),
    }


def _empty_summary() -> dict:
    return {
        "total_reference_cost": 0,
        "total_cheapest_cost": 0,
        "total_savings": 0,
        "total_savings_percentage": 0,
        "farmacia_popular_count": 0,
        "farmacia_popular_free_count": 0,
    }
