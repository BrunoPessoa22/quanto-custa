from __future__ import annotations
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Neon Postgres
    DATABASE_URL: str = ""

    # AI Vision
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Affiliate (Awin)
    AWIN_PUBLISHER_ID: str = ""
    AWIN_API_KEY: str = ""
    AWIN_DROGASIL_PROGRAM_ID: str = ""
    AWIN_DROGA_RAIA_PROGRAM_ID: str = ""
    AWIN_PAGUE_MENOS_PROGRAM_ID: str = ""

    # Payments (Asaas)
    ASAAS_API_KEY: str = ""
    ASAAS_WEBHOOK_SECRET: str = ""

    # App
    APP_URL: str = "https://quantocusta.com.br"
    ENVIRONMENT: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
