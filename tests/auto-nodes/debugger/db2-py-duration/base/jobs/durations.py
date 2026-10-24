import re

_PART = re.compile(r"(\d+)([hms])")
_UNIT = {"h": 3600, "m": 60, "s": 1}


def parse_duration(text: str) -> int:
    m = _PART.search(text)
    if not m:
        raise ValueError(f"bad duration: {text!r}")
    return int(m.group(1)) * _UNIT[m.group(2)]
