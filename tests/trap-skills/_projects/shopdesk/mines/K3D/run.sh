#!/usr/bin/env bash
# Мины K3D (SD-18, тесты на api/src/services/checkout.ts); ветка feature/checkout-tests. run.sh <repo> [-v]
exec bash "$(cd "$(dirname "$0")/.." && pwd)/design-run.sh" "$1" "$(cd "$(dirname "$0")" && pwd)" "${2:-}"
