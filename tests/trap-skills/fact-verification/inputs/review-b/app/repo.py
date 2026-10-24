import json
from dataclasses import dataclass
from typing import Optional

from sqlalchemy import text

from .db import engine


@dataclass
class Member:
    id: int
    points: int


def get_member(member_id: int) -> Optional[Member]:
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT id, points FROM members WHERE id = :id"), {"id": member_id}
        ).first()
    return Member(row.id, row.points) if row else None


def save_member(member: Member) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE members SET points = :p WHERE id = :id"),
            {"p": member.points, "id": member.id},
        )


def write_audit(member_id: int, payload: dict) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO audit (member_id, payload) VALUES (:m, :p)"),
            {"m": member_id, "p": json.dumps(payload, default=str)},
        )
