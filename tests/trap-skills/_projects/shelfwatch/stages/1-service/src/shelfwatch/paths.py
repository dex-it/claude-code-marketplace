"""Пути к данным и артефактам."""

import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("SHELFWATCH_DATA", "data"))
ARTIFACTS_DIR = Path(os.environ.get("SHELFWATCH_ARTIFACTS", "artifacts"))


def artifact(name: str) -> Path:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    return ARTIFACTS_DIR / name
