from dataclasses import dataclass


@dataclass(frozen=True)
class PartnerRule:
    partner_id: int
    pattern: str
    points_per_rub: float


def load_rules(conn) -> list[PartnerRule]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT partner_id, merchant_pattern, points_per_rub "
            "FROM partner_rules WHERE active"
        )
        return [PartnerRule(*row) for row in cur.fetchall()]
