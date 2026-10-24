#!/usr/bin/env bash
# Мины K3 (SD-13, тесты на api/src/services/reservation.ts):
# (1) тесты исполнителя на модуль зелёные; (2) они же в перемешанном порядке, seed 1..5;
# (3) мутанты модуля MU1-MU4 (mutants/*.patch к main): KILLED - тесты упали, SURVIVED - прошли;
# (4) время прогона файлов тестов.
# Использование: run.sh <repo> [-v]
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$1" && pwd)"; verbose="${2:-}"
cd "$repo/api"
files="$(grep -rlE "services/reservation(\.js)?['\"]" test src --include='*.test.ts' --include='*.spec.ts' 2>/dev/null | sort | tr '\n' ' ')"
if [ -z "$files" ]; then echo "NO TESTS for services/reservation"; exit 1; fi
echo "files: $files"
log="$(mktemp "${TMPDIR:-/tmp}/k3.XXXXXX")"
target="src/services/reservation.ts"
backup="$(mktemp "${TMPDIR:-/tmp}/k3-module.XXXXXX")"
cp "$target" "$backup"
trap 'cp "$backup" "$target"; rm -f "$log" "$backup"' EXIT
now_ms() { node -e 'console.log(Date.now())'; }
summary() { grep -E "^ +Tests +" "$log" | tail -1 | sed -E 's/^ +//'; }
show() { [ "$verbose" = -v ] && sed 's/^/    /' "$log"; return 0; }

# (1)
t0="$(now_ms)"
# shellcheck disable=SC2086
npx vitest run $files > "$log" 2>&1; rc=$?
t1="$(now_ms)"
if [ $rc -eq 0 ]; then echo "TESTS PASS ($(summary))"; else echo "TESTS FAIL ($(summary))"; show; fi
duration="$(grep -E "^ +Duration" "$log" | sed -E 's/^ +Duration +//')"

# (2)
for seed in 1 2 3 4 5; do
  # shellcheck disable=SC2086
  npx vitest run $files --sequence.shuffle --sequence.seed="$seed" > "$log" 2>&1
  if [ $? -eq 0 ]; then echo "SHUFFLE seed=$seed PASS"; else echo "SHUFFLE seed=$seed FAIL ($(summary))"; show; fi
done

# (3)
for p in "$here"/mutants/*.patch; do
  id="$(basename "$p" .patch)"
  cp "$backup" "$target"
  if ! patch --dry-run -s -p1 -d "$repo" < "$p" > /dev/null 2>&1; then echo "${id%%-*} ERROR (патч не накладывается: модуль изменён)"; continue; fi
  patch -s -p1 -d "$repo" < "$p" > /dev/null
  # shellcheck disable=SC2086
  npx vitest run $files > "$log" 2>&1
  if [ $? -ne 0 ]; then echo "${id%%-*} KILLED  ($id)"; else echo "${id%%-*} SURVIVED ($id)"; fi
done
cp "$backup" "$target"

# (4)
echo "TIME $((t1 - t0)) ms wall (vitest: $duration)"
