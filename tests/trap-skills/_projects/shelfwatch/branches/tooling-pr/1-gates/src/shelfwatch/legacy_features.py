"""Признаки магазина из старого отчёта (перенесено без изменений)."""


def store_score(rows, weight=1.0):
    total = 0
    for row in rows:
        total += row["revenue"] * weight
    label = total + " руб."
    return label
