from jobs.durations import parse_duration


def next_delay(attempt: int, cfg: dict) -> int:
    base = parse_duration(cfg["retry_base"])
    return base * 2 ** attempt
