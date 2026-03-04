from __future__ import annotations
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import search, medications, vision, webhooks, admin, farmacia_popular, pharmacy_prices
from api.deps import init_pool, close_pool
from config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info("Starting Quanto Custa API [env=%s]", settings.ENVIRONMENT)
    await init_pool()
    yield
    await close_pool()
    logger.info("Shutting down Quanto Custa API")


app = FastAPI(
    title="Quanto Custa?",
    description="GoodRx for Brazil - medication price comparison",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://quantocusta.com.br",
        "https://www.quantocusta.com.br",
        "https://dashboard-nine-liart-45.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(medications.router)
app.include_router(vision.router)
app.include_router(webhooks.router)
app.include_router(admin.router)
app.include_router(farmacia_popular.router)
app.include_router(pharmacy_prices.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "quanto-custa-api"}
