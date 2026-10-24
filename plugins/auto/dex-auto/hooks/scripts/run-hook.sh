#!/usr/bin/env bash
# Гейт python3: у Stop единственный безопасный исход отказа - пропуск, иначе ход нечем закончить.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
hook=${1:-}

if command -v python3 >/dev/null 2>&1; then exec python3 "$H/$hook.py"; fi

case "$hook" in
  stop-guard)    echo "dex-auto: нет python3 - терминал цели не проверен, остановка разрешена" >&2 ;;
  session-start) echo "dex-auto: нет python3 - открытая цель не поднята" >&2 ;;
esac
exit 0
