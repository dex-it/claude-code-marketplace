#!/usr/bin/env bash
# Регрессия ledger и сторожей dex-auto на временном CLAUDE_CONFIG_DIR (долг ADR-0001: ловец адреса).
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T/cfg"; export DEX_AUTO_CWD="/home/u/Work my.proj"
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }
L="$H/ledger.sh"
check "$("$L" root)" "$T/cfg/projects/-home-u-Work-my-proj/ledger" "slug: символы вне [A-Za-z0-9-] -> '-', ведущий '/' даёт ведущий '-'"
f="$("$L" open "PROJ-1" autonomous)"
check "$f" "$T/cfg/projects/-home-u-Work-my-proj/ledger/PROJ-1/00-goal.md" "open: адрес 00-goal.md"
check "$(grep -c '^Статус: открыт$' "$f")" "1" "open: буквальный контракт статуса"
check "$("$L" find)" "$(printf 'PROJ-1\t%s' "$(dirname "$f")")" "find: открытая цель одной строкой TASK<TAB>dir"
"$L" set PROJ-1 Режим interactive; check "$("$L" get PROJ-1 Режим)" "interactive" "set/get: замена строки"
check "$("$L" bump PROJ-1 stop-блоков)" "1" "bump: счётчик из 0 в 1"
"$L" set PROJ-1 Новый-ключ x; check "$("$L" get PROJ-1 Новый-ключ)" "x" "set: дописывание отсутствующей строки в шапку"
check "$(grep -n "^Новый-ключ:" "$f" | cut -d: -f1)" "9" "set: дописанная строка в конце шапки, после stop-блоков"
IN='{"cwd":"/home/u/Work my.proj","source":"startup","hook_event_name":"SessionStart"}'
out="$(printf '%s' "$IN" | "$H/session-start.sh")"; check "$(printf '%s' "$out" | grep -c 'открытая цель PROJ-1')" "1" "session-start: инжект по открытой цели на startup"
out="$(printf '%s' "${IN/startup/clear}" | "$H/session-start.sh")"; check "$out" "" "session-start: source=clear молчит"
out="$(printf '%s' "${IN/startup/compact}" | "$H/session-start.sh")"; check "$(printf '%s' "$out" | grep -c 'PROJ-1')" "1" "session-start: compact поднимает"
"$L" set PROJ-1 Режим autonomous; "$L" set PROJ-1 stop-блоков 0
SIN='{"cwd":"/home/u/Work my.proj","stop_hook_active":false}'
err="$(printf '%s' "$SIN" | "$H/stop-guard.sh" 2>&1 >/dev/null)"; rc=$?
check "$rc" "2" "stop-guard: открытая цель -> код 2"; check "$(printf '%s' "$err" | grep -c 'стоп-блок 1 из')" "1" "stop-guard: причина в stderr со счётчиком"
printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1; printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1
check "$("$L" get PROJ-1 stop-блоков)" "3" "stop-guard: счётчик в 00-goal.md"
printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1; rc=$?
check "$rc" "0" "stop-guard: потолок -> пропуск"; check "$(grep -c '^Stop-потолок: достигнут' "$f")" "1" "stop-guard: пропуск на потолке записан"
"$L" set PROJ-1 stop-блоков 0; "$L" set PROJ-1 Исход blocked
printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1; check "$?" "2" "stop-guard: blocked без Нехватки не пропускает"
"$L" set PROJ-1 Нехватка "доступ к стенду"; printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1; check "$?" "0" "stop-guard: blocked с Нехваткой пропускает"
"$L" set PROJ-1 Исход ""; "$L" set PROJ-1 Режим interactive; "$L" set PROJ-1 Ожидает оператор
printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1; check "$?" "0" "stop-guard: interactive + Ожидает: оператор пропускает"
"$L" close PROJ-1; check "$("$L" find)" "" "close: цель исчезает из find"
check "$("$L" get PROJ-1 Исход)" "complete" "close: Исход по умолчанию complete (P11: пустой Исход у закрытой цели)"
printf '%s' "$SIN" | "$H/stop-guard.sh" >/dev/null 2>&1; check "$?" "0" "stop-guard: без открытой цели молчит"
out="$(printf '%s' "$IN" | "$H/session-start.sh")"; check "$out" "" "session-start: без открытой цели молчит"
"$L" open PROJ-2 >/dev/null; "$L" open PROJ-3 >/dev/null
out="$(printf '%s' "$IN" | "$H/session-start.sh")"; check "$(printf '%s' "$out" | grep -c 'дефект R5')" "1" "session-start: две открытые цели названы дефектом R5"
[ "$fail" = 0 ] && echo "ledger.test.sh: $n проверок, все прошли" || { echo "ledger.test.sh: есть провалы"; exit 1; }
