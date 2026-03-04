from __future__ import annotations
import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request

from api.deps import get_db
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/asaas")
async def asaas_webhook(
    request: Request,
    pool: asyncpg.Pool | None = Depends(get_db),
):
    """Handle Asaas payment webhooks."""
    settings = get_settings()

    if settings.ASAAS_WEBHOOK_SECRET:
        signature = request.headers.get("asaas-access-token", "")
        if signature != settings.ASAAS_WEBHOOK_SECRET:
            raise HTTPException(401, "Invalid webhook signature")

    payload = await request.json()
    event = payload.get("event")

    if not pool:
        return {"received": True, "warning": "Database not configured"}

    if event == "PAYMENT_CONFIRMED":
        await _handle_payment_confirmed(pool, payload.get("payment", {}))
    elif event == "PAYMENT_OVERDUE":
        await _handle_payment_overdue(pool, payload.get("payment", {}))
    elif event == "PAYMENT_DELETED":
        await _handle_subscription_cancelled(pool, payload.get("payment", {}))

    return {"received": True}


async def _handle_payment_confirmed(pool: asyncpg.Pool, payment: dict):
    external_id = payment.get("subscription")
    if not external_id:
        return

    row = await pool.fetchrow(
        "SELECT id, user_id FROM subscriptions WHERE external_subscription_id = $1",
        external_id,
    )
    if not row:
        logger.warning("Subscription not found for external_id=%s", external_id)
        return

    await pool.execute("UPDATE subscriptions SET status = 'active' WHERE id = $1", row["id"])
    await pool.execute("UPDATE users SET is_premium = TRUE WHERE id = $1", row["user_id"])
    logger.info("Subscription activated: user_id=%s", row["user_id"])


async def _handle_payment_overdue(pool: asyncpg.Pool, payment: dict):
    external_id = payment.get("subscription")
    if not external_id:
        return

    await pool.execute(
        "UPDATE subscriptions SET status = 'past_due' WHERE external_subscription_id = $1",
        external_id,
    )
    logger.info("Subscription past_due: external_id=%s", external_id)


async def _handle_subscription_cancelled(pool: asyncpg.Pool, payment: dict):
    external_id = payment.get("subscription")
    if not external_id:
        return

    row = await pool.fetchrow(
        "SELECT id, user_id FROM subscriptions WHERE external_subscription_id = $1",
        external_id,
    )
    if not row:
        return

    await pool.execute("UPDATE subscriptions SET status = 'cancelled' WHERE id = $1", row["id"])
    await pool.execute("UPDATE users SET is_premium = FALSE WHERE id = $1", row["user_id"])
    logger.info("Subscription cancelled: user_id=%s", row["user_id"])
