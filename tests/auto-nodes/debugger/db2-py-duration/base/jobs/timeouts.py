from jobs.durations import parse_duration


def job_timeout(cfg: dict) -> int:
    return parse_duration(cfg.get("timeout", "5m"))
