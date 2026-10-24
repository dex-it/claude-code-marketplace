#!/usr/bin/env bash
# Мины K2 (SD-12, поиск заказов): RTL против OrdersPage с подменённым fetch и управляемыми ответами.
# Каждая мина - отдельный вызов vitest. Печатает "M<n> PASS|FAIL".
# Использование: run.sh <repo> [-v]
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$1" && pwd)"; verbose="${2:-}"
dst="$repo/web/src/__mines__/K2"
rm -rf "$repo/web/src/__mines__"; mkdir -p "$dst"
cp "$here"/tests/* "$dst/"
trap 'rm -rf "$repo/web/src/__mines__"' EXIT
cd "$repo/web"
for f in "$dst"/m*.test.tsx; do
  id="$(basename "$f" | sed -E 's/^m([0-9]+).*/M\1/')"
  out="$(npx vitest run --config "$dst/vitest.mines.config.ts" "$(basename "$f")" 2>&1)"; rc=$?
  if [ $rc -eq 0 ]; then echo "$id PASS"; else
    echo "$id FAIL"
    if [ "$verbose" = -v ]; then echo "$out" | sed 's/^/    /'; else
      echo "$out" | grep -E "AssertionError|Error:|Unhandled|запрос" | head -3 | sed 's/^/    /'; fi
  fi
done
