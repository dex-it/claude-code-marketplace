#!/usr/bin/env bash
# Общие мины кейсов K3D (SD-18) и K3N (SD-19): тесты исполнителя на модули ветки.
# (1) тесты зелёные и сколько раз вызван настоящий fetch (tripwire); (2) они же в перемешанном порядке, seed 1..5;
# (3) мутанты mutants/*.patch (к ветке feature/<имя>): KILLED - тесты упали, SURVIVED - прошли,
#     ERROR - src изменён исполнителем и патч не лёг; (4) статика: vi.mock / vi.spyOn / vi.fn и проверки вызовов.
# Использование: design-run.sh <repo> <каталог мин K3D|K3N> [-v]
# DESIGN_BASE (по умолчанию HEAD) - с чем сравнивать при поиске файлов тестов: для кейсов ревью (K3R) тесты закоммичены в ветке,
# база - feature/checkout-tests; мутанты и tripwire берутся из <каталога мин> (K3R берёт K3D).
set -uo pipefail
repo="$(cd "$1" && pwd)"; mines="$(cd "$2" && pwd)"; verbose="${3:-}"
cd "$repo"
git add -A -N . 2>/dev/null
files="$(git diff --name-only "${DESIGN_BASE:-HEAD}" -- api | grep -E '\.(test|spec)\.ts$' | sed 's#^api/##' | sort | tr '\n' ' ')"
if [ -z "$files" ]; then echo "NO TESTS"; exit 1; fi
echo "files: $files"
if [ -n "$(git diff --name-only HEAD -- api/src)" ]; then echo "SRC CHANGED: $(git diff --name-only HEAD -- api/src | tr '\n' ' ')"; fi
cd api
log="$(mktemp "${TMPDIR:-/tmp}/k3d.XXXXXX")"; trip="$(mktemp "${TMPDIR:-/tmp}/k3d-trip.XXXXXX")"
cat > vitest.mine.config.ts <<CFG
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['test/**/*.test.ts'], setupFiles: ['$mines/fetch-tripwire.ts'] } });
CFG
trap 'rm -f vitest.mine.config.ts "$log" "$trip"; git -C "$repo" checkout -q -- api/src 2>/dev/null' EXIT
export TRIPWIRE_LOG="$trip"
summary() { grep -E "^ +Tests +" "$log" | tail -1 | sed -E 's/^ +//'; }
show() { [ "$verbose" = -v ] && sed 's/^/    /' "$log"; return 0; }
vt() { npx vitest run --config vitest.mine.config.ts "$@" > "$log" 2>&1; }

# (1)
: > "$trip"
# shellcheck disable=SC2086
vt $files; rc=$?
if [ $rc -eq 0 ]; then echo "TESTS PASS ($(summary))"; else echo "TESTS FAIL ($(summary))"; show; fi
echo "REAL-FETCH $(wc -l < "$trip" | tr -d ' ')"

# (2)
for seed in 1 2 3 4 5; do
  # shellcheck disable=SC2086
  vt $files --sequence.shuffle --sequence.seed="$seed"
  if [ $? -eq 0 ]; then echo "SHUFFLE seed=$seed PASS"; else echo "SHUFFLE seed=$seed FAIL ($(summary))"; show; fi
done

# (3)
for p in "$mines"/mutants/*.patch; do
  id="$(basename "$p" .patch)"
  git -C "$repo" checkout -q -- api/src
  if ! patch --dry-run -s -p1 -d "$repo" < "$p" > /dev/null 2>&1; then echo "${id%%-*} ERROR (патч не накладывается: src изменён)"; continue; fi
  patch -s -p1 -d "$repo" < "$p" > /dev/null
  # shellcheck disable=SC2086
  vt $files
  if [ $? -ne 0 ]; then echo "${id%%-*} KILLED  ($id)"; else echo "${id%%-*} SURVIVED ($id)"; fi
done
git -C "$repo" checkout -q -- api/src

# (4)
cd "$repo/api"
# shellcheck disable=SC2086
echo "STATIC vi.mock=$(cat $files | grep -c 'vi\.mock(') vi.spyOn=$(cat $files | grep -c 'vi\.spyOn(') vi.fn=$(cat $files | grep -c 'vi\.fn(') toHaveBeenCalled*=$(cat $files | grep -cE 'toHaveBeenCalled|toBeCalled') expect=$(cat $files | grep -c 'expect(')"
# shellcheck disable=SC2086
cat $files | grep -E "vi\.mock\(" | sed -E 's/^ +//' | cut -c1-110 | sed 's/^/  mock: /'
true
