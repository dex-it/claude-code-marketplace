#!/usr/bin/env bash
# Регрессия обхода дерева валидаторами: symlink и спецфайл под plugins/ - отказ с кодом 1 и названным путём.
# Раньше обход шёл по ссылке: цикл ронял прогон стектрейсом ELOOP, FIFO вешал чтение, ссылка наружу судила
# чужой файл как свой. Дерево - копия базы фикстур через MARKETPLACE_ROOT, сеть не нужна.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

base() { # <имя> -> копия базы фикстур
  local t="$tmp/$1"
  mkdir -p "$t"; cp -R "$root/tools/__fixtures__/_base/." "$t/"
  echo "$t"
}

# check <валидатор> <дерево> <описание>
check() {
  local out rc
  # perl alarm - переносимый таймаут: у macOS нет timeout, а зависание и есть проверяемый дефект.
  out=$(MARKETPLACE_ROOT="$2" perl -e 'alarm 20; exec @ARGV' node "$root/tools/$1" all 2>&1); rc=$?
  [ "$rc" -eq 1 ] && grep -q 'symlinks and special files are not followed' <<<"$out" \
    && ok "$1: $3" || bad "$1: $3 - rc=$rc, $(tail -3 <<<"$out")"
}

# Цикл ссылок внутри плагина специалиста: под обход попадают все валидаторы, идущие по plugins/.
t=$(base loop)
ln -s ../.. "$t/plugins/specialists/fixture/dex-fixture-specialist/loop"
for v in validate-agent.js validate-skill.js validate-command.js validate-bundle.js validate-node-contract.js; do
  check "$v" "$t" "цикл symlink -> отказ"
done

# Ссылка на каталог скилла - validate-readme обходит skills/ по записям каталога.
t=$(base skilllink)
ln -s . "$t/plugins/skills/dex-skill-fixture/skills/linked"
check validate-readme.js "$t" "symlink в skills/ -> отказ"

# FIFO под agents/ - раньше чтение висело.
t=$(base fifo)
mkfifo "$t/plugins/specialists/fixture/dex-fixture-specialist/agents/pipe.md"
check validate-node-contract.js "$t" "FIFO -> отказ без зависания"

[ "$fail" -eq 0 ] && echo "tree-plain.test.sh: все проверки прошли" || echo "tree-plain.test.sh: есть провалы"
exit "$fail"
