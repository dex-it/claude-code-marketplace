#!/usr/bin/env bash
# Мины K3R / K3RN (ревью тестов к SD-18): засеянные тесты закоммичены в ветке feature/checkout-tests-mr1 (K3R) и
# feature/checkout-tests-mr2 (K3RN, «ничего не менять») поверх feature/checkout-tests. Скрипт не судит ревью:
# он проверяет детерминированно, что сид настоящий (тесты зелёные, перемешивание и мутанты ведут себя по ключу).
# Мутанты и tripwire - из ../K3D (модули те же). run.sh <repo> [-v]; repo - развёрнутый setup.sh на любой из двух веток.
here="$(cd "$(dirname "$0")" && pwd)"
export DESIGN_BASE=feature/checkout-tests
exec bash "$here/../design-run.sh" "$1" "$here/../K3D" "${2:-}"
