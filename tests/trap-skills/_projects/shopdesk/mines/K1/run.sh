#!/usr/bin/env bash
# Мины K1 (SD-11, оплата заказа): каждая мина - отдельный вызов vitest против createApp из api/src/app.ts
# с фейковыми payments/notifier/analytics. Печатает "M<n> PASS|FAIL".
# Использование: run.sh <repo> [-v]   (-v - показать вывод vitest)
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$1" && pwd)"; verbose="${2:-}"
dst="$repo/api/test/__mines__/K1"
rm -rf "$repo/api/test/__mines__"; mkdir -p "$dst"
cp "$here"/tests/* "$dst/"
trap 'rm -rf "$repo/api/test/__mines__"' EXIT
cd "$repo/api"
for f in "$dst"/m*.test.ts; do
  id="$(basename "$f" | sed -E 's/^m([0-9]+).*/M\1/')"
  out="$(npx vitest run --config "$dst/vitest.mines.config.ts" "$(basename "$f")" 2>&1)"; rc=$?
  if [ $rc -eq 0 ]; then echo "$id PASS"; else
    echo "$id FAIL"
    if [ "$verbose" = -v ]; then echo "$out" | sed 's/^/    /'; else
      echo "$out" | grep -E "AssertionError|Error:|Unhandled|expected|no response" | head -3 | sed 's/^/    /'; fi
  fi
done
