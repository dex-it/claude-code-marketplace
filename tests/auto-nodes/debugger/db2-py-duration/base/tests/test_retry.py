from jobs.retry import next_delay


def test_first_retry_waits_base():
    assert next_delay(0, {"retry_base": "30s"}) == 30


def test_backoff_doubles():
    assert next_delay(2, {"retry_base": "10s"}) == 40
