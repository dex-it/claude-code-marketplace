#!/usr/bin/env bash
# Мины K3N (SD-19, тесты на api/src/services/price-format.ts); ветка feature/money-tests. run.sh <repo> [-v]
exec bash "$(cd "$(dirname "$0")/.." && pwd)/design-run.sh" "$1" "$(cd "$(dirname "$0")" && pwd)" "${2:-}"
