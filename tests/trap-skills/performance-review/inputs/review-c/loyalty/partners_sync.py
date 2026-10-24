import asyncio
import os

import httpx

from loyalty.db import connection

PARTNERS_API = os.environ["PARTNERS_API"]


async def fetch_partner(client: httpx.AsyncClient, partner_id: int) -> dict:
    resp = await client.get(f"{PARTNERS_API}/partners/{partner_id}")
    resp.raise_for_status()
    return resp.json()


async def sync_partners() -> int:
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM partners WHERE active")
            ids = [r[0] for r in cur.fetchall()]

        async with httpx.AsyncClient(timeout=10) as client:
            partners = await asyncio.gather(*(fetch_partner(client, i) for i in ids))

        with conn.cursor() as cur:
            for p in partners:
                cur.execute(
                    "UPDATE partners SET name = %s, cashback_cap = %s WHERE id = %s",
                    (p["name"], p["cashback_cap"], p["id"]),
                )
        conn.commit()
    return len(partners)
