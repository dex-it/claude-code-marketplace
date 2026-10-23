#!/usr/bin/env bash
# Разворачивает мини-проект Meridian (генератор generate.py) в <dest>: ветки main (кейс F1),
# feature/partial-refunds (R1), feature/tariff-cache (N0). Детерминированно; код не собирается.
# Использование: setup.sh <dest> [ветка для checkout]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
export PYTHONDONTWRITEBYTECODE=1
exec python3 "$here/generate.py" "$@"
