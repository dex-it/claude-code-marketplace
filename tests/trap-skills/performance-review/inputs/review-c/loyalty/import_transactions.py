import csv
import logging
import re
from datetime import datetime

from loyalty.db import connection
from loyalty.report import ReportBuilder
from loyalty.rules import load_rules

log = logging.getLogger(__name__)


def match_rule(rules, merchant: str):
    for rule in rules:
        if re.search(rule.pattern, merchant, re.IGNORECASE):
            return rule
    return None


def import_file(path: str) -> str:
    report = ReportBuilder(title=f"Импорт {path}")
    with connection() as conn:
        rules = load_rules(conn)
        accruals = []
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f, delimiter=";"):
                try:
                    amount = float(row["amount"])
                    rule = match_rule(rules, row["merchant"])
                    if rule is None:
                        report.add_skipped(row["tx_id"], "нет правила партнёра")
                        continue
                    points = round(amount * rule.points_per_rub)
                    accruals.append((
                        row["tx_id"],
                        int(row["member_id"]),
                        rule.partner_id,
                        points,
                        datetime.fromisoformat(row["tx_time"]),
                    ))
                    report.add_accrual(row["tx_id"], points)
                except (KeyError, ValueError) as e:
                    report.add_skipped(row.get("tx_id", "?"), str(e))

        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO accruals (tx_id, member_id, partner_id, points, tx_time) "
                "VALUES (%s, %s, %s, %s, %s)",
                accruals,
            )
            for tx_id, member_id, _, points, _ in accruals:
                try:
                    cur.execute(
                        "UPDATE members SET balance = balance + %s WHERE id = %s",
                        (points, member_id),
                    )
                except Exception:
                    log.exception("balance update failed for %s", tx_id)
                    continue
        conn.commit()
    return report.render()
