import os
from contextlib import contextmanager

from psycopg2.pool import ThreadedConnectionPool

_pool = ThreadedConnectionPool(1, 10, dsn=os.environ["LOYALTY_DSN"])


@contextmanager
def connection():
    conn = _pool.getconn()
    try:
        yield conn
    finally:
        _pool.putconn(conn)
