#!/usr/bin/env bash
# sync-tracks --check: копия общего блока в треке и словарь статусов находки. Каждая порча - в своей копии
# plugins/auto через MARKETPLACE_ROOT; отказ - код 1 и названная причина, чистая копия - код 0.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

base() { # <имя> -> копия plugins/auto
  local t="$tmp/$1"
  mkdir -p "$t/plugins"; cp -R "$root/plugins/auto" "$t/plugins/"
  echo "$t"
}
# edit <файл> <python-выражение над s> - порча файла на месте
edit() { python3 - "$1" "$2" <<'PY'
import sys
p, expr = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
s = eval(expr)
open(p, "w", encoding="utf-8").write(s)
PY
}
# check <дерево> <ожидаемый код> <образец вывода> <описание>
check() {
  local out rc
  out=$(MARKETPLACE_ROOT="$1" node "$root/tools/sync-tracks.js" --check 2>&1); rc=$?
  [ "$rc" -eq "$2" ] && grep -q -- "$3" <<<"$out" && ok "$4" || bad "$4 - rc=$rc, $(tail -2 <<<"$out")"
}
T=plugins/auto/dex-auto/tracks; S=plugins/auto/tracks-shared; H=plugins/auto/dex-auto/hooks/scripts

check "$(base clean)" 0 "синхронно" "чистая копия -> 0"

t=$(base block); edit "$t/$T/bugfix.js" "s.replace('// >>> shared: verify\n', '// >>> shared: verify\n// ручная правка\n', 1)"
check "$t" 1 'блок "verify" расходится' "правка внутри блока трека -> расхождение"

t=$(base source); edit "$t/$S/verify.js" "s + '// правка источника\n'"
check "$t" 1 "расходится" "правка источника без пересборки -> расхождение"

t=$(base unmarked); edit "$t/$T/bugfix.js" "s.replace('// >>> shared: verify\n', '', 1).replace('// <<< shared: verify\n', '', 1)"
check "$t" 1 "объявлены вне блока" "маркеры блока сняты, копия осталась -> отказ"

t=$(base indent); edit "$t/$T/feature.js" "s.replace('// >>> shared: verify\n', '  // >>> shared: verify\n', 1).replace('// <<< shared: verify\n', '  // <<< shared: verify\n', 1)"
check "$t" 1 "маркер не по форме" "маркер с отступом -> отказ"

t=$(base tail); edit "$t/$T/review.js" "s.replace('// >>> shared: domain\n', '// >>> shared: domain.v2\n', 1)"
check "$t" 1 "маркер не по форме" "хвост после имени в открывающем маркере -> отказ"

t=$(base marker-in-source); edit "$t/$S/domain.js" "s + '// >>> shared: verify\n'"
check "$t" 1 "строка маркера в источнике" "маркер внутри источника -> отказ"

t=$(base crlf); edit "$t/$T/review.js" "s.replace('\n', '\r\n')"
check "$t" 1 "CR в треке" "CRLF в треке -> отказ"

t=$(base status); edit "$t/$H/dexauto.py" "s.replace('\"unverified\"', '\"unchecked\"', 1)"
check "$t" 1 "OPEN_FINDING" "словарь статусов dexauto.py разошёлся с domain.js -> отказ"

t=$(base repair); edit "$t/$T/bugfix.js" "s.replace('// >>> shared: verify\n', '// >>> shared: verify\n// ручная правка\n', 1)"
MARKETPLACE_ROOT="$t" node "$root/tools/sync-tracks.js" >/dev/null 2>&1
check "$t" 0 "синхронно" "sync пересобирает блок из источника -> check снова 0"

[ "$fail" -eq 0 ] && echo "sync-tracks.test.sh: все проверки прошли" || { echo "sync-tracks.test.sh: есть провалы"; exit 1; }
