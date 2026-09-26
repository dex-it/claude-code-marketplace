import re

from psycopg2.extras import execute_values

CURRENCY_CODE = re.compile(r"^[A-Z]{3}$")


def load_currencies(conn, rows: list[tuple[str, str]]) -> None:
    valid = [(code, name) for code, name in rows if CURRENCY_CODE.match(code)]
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO currencies (code, name) VALUES %s "
            "ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name",
            valid,
        )
    conn.commit()
