from __future__ import annotations
"""ANVISA CMED XLS parser.

Downloads and parses the official CMED price list from ANVISA,
maps columns to the medications table schema, then upserts
into Neon Postgres and builds drug_equivalents mappings.
"""

import logging
from collections import defaultdict
from pathlib import Path

import asyncpg
import httpx
import pandas as pd

logger = logging.getLogger(__name__)

CMED_URL = "https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/cmed/precos/arquivos/lista_conformidade.xls"

CATEGORY_MAP = {
    "REFERÊNCIA": "reference",
    "REFERENCIA": "reference",
    "GENÉRICO": "generic",
    "GENERICO": "generic",
    "SIMILAR": "similar",
    "BIOLÓGICO": "biological",
    "BIOLOGICO": "biological",
    "NOVO": "new",
    "ESPECÍFICO": "specific",
    "ESPECIFICO": "specific",
    "FITOTERÁPICO": "phytotherapic",
    "FITOTERAPICO": "phytotherapic",
}

COLUMN_MAP = {
    "SUBSTÂNCIA": "active_ingredient",
    "SUBSTANCIA": "active_ingredient",
    "PRODUTO": "product_name",
    "LABORATÓRIO": "manufacturer",
    "LABORATORIO": "manufacturer",
    "APRESENTAÇÃO": "presentation",
    "APRESENTACAO": "presentation",
    "TIPO DE PRODUTO": "category_raw",
    "CLASSE TERAPÊUTICA": "therapeutic_class",
    "CLASSE TERAPEUTICA": "therapeutic_class",
    "PF SEM IMPOSTOS": "pf_sem_impostos",
    "PF 0%": "pf_icms_0",
    "PMC 0%": "pmc_icms_0",
    "PMC 12%": "pmc_icms_12",
    "PMC 17%": "pmc_icms_17",
    "PMC 17,5%": "pmc_icms_17",
    "PMC 18%": "pmc_icms_18",
    "PMC 19%": "pmc_icms_19",
    "PMC 20%": "pmc_icms_20",
    "RESTRIÇÃO HOSPITALAR": "hospital_use_only_raw",
    "RESTRICAO HOSPITALAR": "hospital_use_only_raw",
    "TARJA": "restriction",
    "EAN 1": "ean_code",
    "REGISTRO": "anvisa_registry",
    "LISTA DE CONCESSÃO DE CRÉDITO TRIBUTÁRIO (PIS/COFINS)": "farmacia_popular_raw",
}


def normalize_col(name: str) -> str:
    import unicodedata
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    return name.strip().upper()


def parse_cmed_file(file_path: str | Path) -> pd.DataFrame:
    path = Path(file_path)
    if path.suffix in (".xls",):
        df = pd.read_excel(path, engine="xlrd", dtype=str)
    else:
        df = pd.read_excel(path, engine="openpyxl", dtype=str)

    rename_map = {}
    for col in df.columns:
        normalized = normalize_col(str(col))
        for pattern, field in COLUMN_MAP.items():
            if pattern in normalized:
                rename_map[col] = field
                break

    df = df.rename(columns=rename_map)
    return df


def transform_row(row: pd.Series) -> dict | None:
    product_name = str(row.get("product_name", "")).strip()
    active_ingredient = str(row.get("active_ingredient", "")).strip()
    manufacturer = str(row.get("manufacturer", "")).strip()
    presentation = str(row.get("presentation", "")).strip()

    if not product_name or not active_ingredient:
        return None

    category_raw = str(row.get("category_raw", "")).strip().upper()
    category = CATEGORY_MAP.get(category_raw, "new")

    def parse_price(val) -> float | None:
        if pd.isna(val) or val is None:
            return None
        val = str(val).strip().replace(",", ".")
        try:
            return round(float(val), 2)
        except ValueError:
            return None

    hospital_raw = str(row.get("hospital_use_only_raw", "")).strip().upper()
    hospital_use = hospital_raw in ("SIM", "S", "YES", "1")

    fp_raw = str(row.get("farmacia_popular_raw", "")).strip().upper()
    fp_eligible = fp_raw not in ("", "NAN", "NONE", "N/A")
    fp_free = "POSITIVA" in fp_raw or "GRATUITO" in fp_raw or "SIM" in fp_raw

    restriction = str(row.get("restriction", "")).strip().lower()
    if restriction in ("nan", "none", ""):
        restriction = None

    return {
        "product_name": product_name,
        "active_ingredient": active_ingredient,
        "manufacturer": manufacturer,
        "presentation": presentation,
        "category": category,
        "therapeutic_class": _clean_str(row.get("therapeutic_class")),
        "pf_sem_impostos": parse_price(row.get("pf_sem_impostos")),
        "pf_icms_0": parse_price(row.get("pf_icms_0")),
        "pmc_icms_0": parse_price(row.get("pmc_icms_0")),
        "pmc_icms_12": parse_price(row.get("pmc_icms_12")),
        "pmc_icms_17": parse_price(row.get("pmc_icms_17")),
        "pmc_icms_18": parse_price(row.get("pmc_icms_18")),
        "pmc_icms_19": parse_price(row.get("pmc_icms_19")),
        "pmc_icms_20": parse_price(row.get("pmc_icms_20")),
        "farmacia_popular_eligible": fp_eligible,
        "farmacia_popular_free": fp_free,
        "ean_code": _clean_str(row.get("ean_code")),
        "anvisa_registry": _clean_str(row.get("anvisa_registry")),
        "restriction": restriction,
        "hospital_use_only": hospital_use,
    }


def _clean_str(val) -> str | None:
    if pd.isna(val) or val is None:
        return None
    s = str(val).strip()
    return s if s and s.lower() not in ("nan", "none") else None


async def upsert_medications(pool: asyncpg.Pool, records: list[dict]) -> dict:
    """Upsert medications into Neon Postgres. Returns stats."""
    inserted = 0
    errors = 0

    sql = """
        INSERT INTO medications (
            product_name, active_ingredient, manufacturer, presentation, category,
            therapeutic_class, pf_sem_impostos, pf_icms_0,
            pmc_icms_0, pmc_icms_12, pmc_icms_17, pmc_icms_18, pmc_icms_19, pmc_icms_20,
            farmacia_popular_eligible, farmacia_popular_free,
            ean_code, anvisa_registry, restriction, hospital_use_only
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (ean_code) WHERE ean_code IS NOT NULL DO UPDATE SET
            product_name = EXCLUDED.product_name,
            active_ingredient = EXCLUDED.active_ingredient,
            manufacturer = EXCLUDED.manufacturer,
            presentation = EXCLUDED.presentation,
            category = EXCLUDED.category,
            therapeutic_class = EXCLUDED.therapeutic_class,
            pf_sem_impostos = EXCLUDED.pf_sem_impostos,
            pf_icms_0 = EXCLUDED.pf_icms_0,
            pmc_icms_0 = EXCLUDED.pmc_icms_0,
            pmc_icms_12 = EXCLUDED.pmc_icms_12,
            pmc_icms_17 = EXCLUDED.pmc_icms_17,
            pmc_icms_18 = EXCLUDED.pmc_icms_18,
            pmc_icms_19 = EXCLUDED.pmc_icms_19,
            pmc_icms_20 = EXCLUDED.pmc_icms_20,
            farmacia_popular_eligible = EXCLUDED.farmacia_popular_eligible,
            farmacia_popular_free = EXCLUDED.farmacia_popular_free,
            restriction = EXCLUDED.restriction,
            hospital_use_only = EXCLUDED.hospital_use_only,
            updated_at = NOW()
    """

    batch_size = 500
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        try:
            async with pool.acquire() as conn:
                await conn.executemany(sql, [
                    (
                        r["product_name"], r["active_ingredient"], r["manufacturer"],
                        r["presentation"], r["category"], r.get("therapeutic_class"),
                        r.get("pf_sem_impostos"), r.get("pf_icms_0"),
                        r.get("pmc_icms_0"), r.get("pmc_icms_12"), r.get("pmc_icms_17"),
                        r.get("pmc_icms_18"), r.get("pmc_icms_19"), r.get("pmc_icms_20"),
                        r.get("farmacia_popular_eligible", False),
                        r.get("farmacia_popular_free", False),
                        r.get("ean_code"), r.get("anvisa_registry"),
                        r.get("restriction"), r.get("hospital_use_only", False),
                    )
                    for r in batch
                ])
            inserted += len(batch)
        except Exception:
            logger.exception("Batch upsert failed at offset %d", i)
            errors += len(batch)

    return {"inserted": inserted, "errors": errors}


async def build_drug_equivalents(pool: asyncpg.Pool) -> int:
    """Build drug_equivalents by grouping medications by active_ingredient + presentation."""
    rows = await pool.fetch(
        "SELECT id, active_ingredient, presentation, category FROM medications ORDER BY active_ingredient"
    )

    if not rows:
        return 0

    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        key = (
            row["active_ingredient"].strip().lower(),
            row["presentation"].strip().lower(),
        )
        groups[key].append(dict(row))

    equivalents_created = 0

    for key, meds in groups.items():
        if len(meds) < 2:
            continue

        references = [m for m in meds if m["category"] == "reference"]
        generics = [m for m in meds if m["category"] == "generic"]
        similars = [m for m in meds if m["category"] == "similar"]

        if not references:
            continue

        ref = references[0]

        for gen in generics:
            await _insert_equivalent(pool, ref["id"], gen["id"], "generic", key[0])
            equivalents_created += 1

        for sim in similars:
            await _insert_equivalent(pool, ref["id"], sim["id"], "similar_intercambiavel", key[0])
            equivalents_created += 1

    return equivalents_created


async def _insert_equivalent(
    pool: asyncpg.Pool,
    ref_id: int,
    equiv_id: int,
    equiv_type: str,
    active_ingredient: str,
):
    try:
        await pool.execute(
            """INSERT INTO drug_equivalents (reference_medication_id, equivalent_medication_id, equivalent_type, active_ingredient)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (reference_medication_id, equivalent_medication_id) DO NOTHING""",
            ref_id, equiv_id, equiv_type, active_ingredient,
        )
    except Exception:
        logger.debug("Equivalent already exists: ref=%d equiv=%d", ref_id, equiv_id)


async def download_cmed(dest_dir: str = "/tmp") -> str:
    dest = Path(dest_dir) / "cmed_latest.xls"

    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        logger.info("Downloading CMED from %s", CMED_URL)
        resp = await client.get(CMED_URL)
        resp.raise_for_status()

        dest.write_bytes(resp.content)
        logger.info("CMED downloaded: %s (%d bytes)", dest, len(resp.content))

    return str(dest)
