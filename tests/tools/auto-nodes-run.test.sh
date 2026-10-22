#!/usr/bin/env bash
# tests/auto-nodes/run.sh в режиме сухого прогона (AUTO_NODES_DRY_RUN=1): раскрытие повтора N..M, поштучная запись,
# отказ на неверном диапазоне, отсутствие побочных следов. claude и timeout не нужны. Скрипт гоняется обеими
# оболочками: bash из PATH и /bin/bash (на macOS - 3.2, без {N..M} с переменными и без `mapfile`).
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
run="$root/tests/auto-nodes/run.sh"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# check <оболочка> <ожидаемый код> <ожидаемый stdout или -> <описание> <аргументы run.sh>...
check() {
  local sh=$1 want_rc=$2 want_out=$3 what=$4; shift 4
  local out rc
  out=$(AUTO_NODES_DRY_RUN=1 "$sh" "$run" reviewer "$tmp/out" "$@" 2>"$tmp/err"); rc=$?
  if [ "$rc" -ne "$want_rc" ]; then bad "$what - код $rc вместо $want_rc"; return; fi
  if [ "$want_out" != "-" ] && [ "$out" != "$want_out" ]; then bad "$what - вывод «$(tr '\n' ' ' <<<"$out")» вместо «$(tr '\n' ' ' <<<"$want_out")»"; return; fi
  ok "$what"
}

shells="bash"; [ -x /bin/bash ] && [ "$(command -v bash)" != /bin/bash ] && shells="bash /bin/bash"
for sh in $shells; do
  v=$("$sh" -c 'echo "$BASH_VERSION"')
  p="[$sh $v]"
  check "$sh" 0 $'c:v:1\nc:v:2\nc:v:3' "$p c:v:1..3 -> три прогона" c:v:1..3
  check "$sh" 0 $'c:v:2' "$p поштучная запись c:v:2 как есть" c:v:2
  check "$sh" 0 $'c:v:2' "$p диапазон из одного прогона c:v:2..2" c:v:2..2
  check "$sh" 0 $'c:v:9\nc:v:10\nc:v:11' "$p 9..11 - числом, не строкой" c:v:9..11
  check "$sh" 0 $'c:v:8\nc:v:9' "$p ведущий ноль не восьмеричный: 08..9" c:v:08..9
  check "$sh" 0 $'a:old:1\na:old:2\nb:new:3\nb:new:1\nb:new:2' "$p смесь диапазона и поштучной записи в порядке аргументов" a:old:1..2 b:new:3 b:new:1..2
  check "$sh" 0 $'a-b:old:1\na-b:old:2' "$p дефис в имени кейса" a-b:old:1..2
  check "$sh" 2 - "$p обратный диапазон 3..1 - отказ" c:v:3..1
  check "$sh" 2 - "$p нечисловой диапазон a..b - отказ" c:v:a..b
  check "$sh" 2 - "$p пустая граница 1.. - отказ" c:v:1..
  check "$sh" 2 - "$p пустая граница ..3 - отказ" c:v:..3
  check "$sh" 2 - "$p отказ и на второй записи, если первая верна" c:v:1..2 c:v:3..1
  grep -q 'N..M' "$tmp/err" && ok "$p отказ называет формат N..M" || bad "$p отказ не называет формат N..M: $(cat "$tmp/err")"
done

[ ! -e "$tmp/out" ] && ok "сухой прогон не создаёт каталог прогона" || bad "сухой прогон создал $tmp/out"

# Без сухого прогона неверный диапазон тоже отказывает до первого прогона и до создания каталога.
out=$("$run" reviewer "$tmp/real" c:v:3..1 2>&1); rc=$?
{ [ "$rc" -eq 2 ] && [ ! -e "$tmp/real" ]; } && ok "неверный диапазон без DRY_RUN - код 2, каталога нет" || bad "неверный диапазон без DRY_RUN: rc=$rc, $out"

# Живой путь с подставным claude: диапазон даёт отдельные каталоги прогонов, AUTO_NODES_PLUGINS доходит до --plugin-dir.
if command -v timeout >/dev/null 2>&1 || command -v gtimeout >/dev/null 2>&1; then
  mkdir -p "$tmp/bin" "$tmp/plug"
  printf '#!/bin/sh\nprintf "%%s\\n" "$@"\n' > "$tmp/bin/claude"; chmod +x "$tmp/bin/claude"
  for sh in $shells; do
    o="$tmp/live-$(basename "$sh")"
    PATH="$tmp/bin:$PATH" AUTO_NODES_JOBS=1 AUTO_NODES_PLUGINS="$tmp/plug" "$sh" "$run" reviewer "$o" rv0-clamp-clean:new:1..2 rv0-clamp-clean:old:3 >"$tmp/live.log" 2>&1
    dirs=$(cd "$o" 2>/dev/null && ls -d rv0-clamp-clean-* 2>/dev/null | tr '\n' ' ')
    [ "$dirs" = "rv0-clamp-clean-new-1 rv0-clamp-clean-new-2 rv0-clamp-clean-old-3 " ] \
      && ok "[$sh] живой путь: прогоны new-1, new-2, old-3 раздельно" || bad "[$sh] живой путь: каталоги «${dirs}», лог $(tail -3 "$tmp/live.log")"
    grep -qx -- "--plugin-dir" "$o/rv0-clamp-clean-new-2/out.json" && grep -qx "$tmp/plug" "$o/rv0-clamp-clean-new-2/out.json" \
      && ok "[$sh] AUTO_NODES_PLUGINS доходит до claude как --plugin-dir" || bad "[$sh] --plugin-dir каталога плагина не передан"
    # Относительный путь плагина, который раскрывается в путь с пробелом (клон в «~/My Work/...»), остаётся одним аргументом --plugin-dir.
    mkdir -p "$tmp/my work/plug"
    (cd "$tmp/my work" && PATH="$tmp/bin:$PATH" AUTO_NODES_JOBS=1 AUTO_NODES_PLUGINS="plug" "$sh" "$run" reviewer "$tmp/live-space-$(basename "$sh")" rv0-clamp-clean:new:1 >"$tmp/live-space.log" 2>&1)
    grep -qxF -- "$tmp/my work/plug" "$tmp/live-space-$(basename "$sh")/rv0-clamp-clean-new-1/out.json" \
      && ok "[$sh] путь плагина с пробелом - один аргумент --plugin-dir" || bad "[$sh] путь плагина с пробелом распался: $(tail -3 "$tmp/live-space.log")"
  done
else
  echo "skip живой путь: нет timeout/gtimeout"
fi

# build.mjs: поля судьи не попадают в собранный скрипт, неизвестное поле кейса - отказ сборки.
for n in reviewer coder debugger skeptic; do
  node "$root/tests/auto-nodes/build.mjs" "$n" "$tmp/wf-$n.js" >/dev/null 2>"$tmp/build.err" \
    && ok "build.mjs собирает $n" || bad "build.mjs не собрал $n: $(cat "$tmp/build.err")"
done
grep -q 'false_lead' "$tmp/wf-debugger.js" && bad "false_lead (ключ судьи db4) попал в workflow.js" || ok "false_lead не попал в workflow.js"

# Нет аргументов - использование, код 2.
"$run" >/dev/null 2>&1; [ "$?" -eq 2 ] && ok "без аргументов - код 2" || bad "без аргументов не код 2"

exit "$fail"
