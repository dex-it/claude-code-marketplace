#!/usr/bin/env bash
# Регрессия ledger и сторожей dex-auto на временном CLAUDE_CONFIG_DIR (долг ADR-0001: ловец адреса).
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T/cfg"; export DEX_AUTO_CWD="/home/u/Work my.proj"
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }
L="$H/ledger.py"
check "$("$L" root)" "$T/cfg/projects/-home-u-Work-my-proj/ledger" "slug: символы вне [A-Za-z0-9-] -> '-', ведущий '/' даёт ведущий '-'"
f="$("$L" open "PROJ-1" autonomous)"
check "$f" "$T/cfg/projects/-home-u-Work-my-proj/ledger/PROJ-1/00-goal.md" "open: адрес 00-goal.md"
check "$(grep -c '^Статус: открыт$' "$f")" "1" "open: буквальный контракт статуса"
check "$("$L" find)" "$(printf 'PROJ-1\t%s' "$(dirname "$f")")" "find: открытая цель одной строкой TASK<TAB>dir"
"$L" set PROJ-1 Режим interactive; check "$("$L" get PROJ-1 Режим)" "interactive" "set/get: замена строки"
"$L" set PROJ-1 Новый-ключ x; check "$("$L" get PROJ-1 Новый-ключ)" "x" "set: дописывание отсутствующей строки в шапку"
check "$(grep -n "^Новый-ключ:" "$f" | cut -d: -f1)" "8" "set: дописанная строка в конце шапки, после Ожидает"
IN='{"cwd":"/home/u/Work my.proj","source":"startup","hook_event_name":"SessionStart"}'
out="$(printf '%s' "$IN" | "$H/session-start.py")"; check "$(printf '%s' "$out" | grep -c 'открытая цель PROJ-1')" "1" "session-start: инжект по открытой цели на startup"
out="$(printf '%s' "${IN/startup/clear}" | "$H/session-start.py")"; check "$out" "" "session-start: source=clear молчит"
out="$(printf '%s' "${IN/startup/compact}" | "$H/session-start.py")"; check "$(printf '%s' "$out" | grep -c 'PROJ-1')" "1" "session-start: compact поднимает"
check "$(printf '%s' "$out" | grep -c '/dex-auto:auto PROJ-1 продолжить')" "0" "session-start: трека нет - «продолжить» не советуется (resume без trail пропускает фазу правки)"
check "$(printf '%s' "$out" | grep -c 'трека по этой цели не было')" "1" "session-start: без трека назван исход - запуск с нуля"
printf 'Статус: открыт\n' > "$(dirname "$f")/01-feature.md"
out="$(printf '%s' "$IN" | "$H/session-start.py")"
check "$(printf '%s' "$out" | grep -c 'файлы трека 01-feature.md')" "1" "session-start: открытый трек назван файлом"
check "$(printf '%s' "$out" | grep -c '/dex-auto:auto PROJ-1 продолжить')" "1" "session-start: при открытом треке советуется «продолжить»"
rm "$(dirname "$f")/01-feature.md"
"$L" set PROJ-1 Режим autonomous
SIN='{"cwd":"/home/u/Work my.proj","stop_hook_active":false}'
err="$(printf '%s' "$SIN" | "$H/stop-guard.py" 2>&1 >/dev/null)"; rc=$?
check "$rc" "2" "stop-guard: открытая цель -> код 2"; check "$(printf '%s' "$err" | grep -c 'цель PROJ-1 открыта')" "1" "stop-guard: причина в stderr"
for _ in 1 2 3 4; do printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; rc=$?; done
check "$rc" "2" "stop-guard: своего потолка нет - повторные блоки снимает платформа"; check "$(grep -c '^stop-блоков\|^Stop-потолок' "$f")" "0" "stop-guard: счётчика в 00-goal.md нет"
"$L" set PROJ-1 Исход blocked
printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; check "$?" "2" "stop-guard: blocked без Нехватки не пропускает"
"$L" set PROJ-1 Нехватка "доступ к стенду"; printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; check "$?" "0" "stop-guard: blocked с Нехваткой пропускает"
"$L" set PROJ-1 Исход ""; "$L" set PROJ-1 Режим interactive; "$L" set PROJ-1 Ожидает оператор
printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; check "$?" "0" "stop-guard: interactive + Ожидает: оператор пропускает"
"$L" set PROJ-1 Ожидает "оператор - нужен доступ к стенду"
printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; check "$?" "0" "stop-guard: уточнение после значения не ломает разрешение (префикс, не равенство)"
"$L" set PROJ-1 Ожидает "жду ответа оператора"
printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; check "$?" "2" "stop-guard: значение не из перечня не разрешает уход"
"$L" set PROJ-1 Ожидает оператор
printf 'Статус: открыт\n' > "$(dirname "$f")/01-feature.md"
printf 'Статус: закрыт\n' > "$(dirname "$f")/01-review.md"
check "$("$L" open-tracks PROJ-1)" "01-feature.md" "open-tracks: только файлы трека со Статус: открыт"
check "$("$L" open-tracks PROJ-404)" "" "open-tracks: папки цели нет - пусто и код 0"
rm -f "$(dirname "$f")/01-feature.md" "$(dirname "$f")/01-review.md"
"$L" close PROJ-1 >/dev/null 2>&1; check "$?" "64" "close: без исхода отказ (подсказка не пишет ложный complete)"
check "$("$L" get PROJ-1 Статус)" "открыт" "close: при отказе файл не тронут"
"$L" close PROJ-1 zzz >/dev/null 2>&1; check "$?" "64" "close: исход вне перечня отказ"
"$L" close PROJ-1 complete; check "$("$L" find)" "" "close: цель исчезает из find"
check "$("$L" get PROJ-1 Исход)" "complete" "close: исход записан явным аргументом (P11: пустой Исход у закрытой цели)"
printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; check "$?" "0" "stop-guard: без открытой цели молчит"
out="$(printf '%s' "$IN" | "$H/session-start.py")"; check "$out" "" "session-start: без открытой цели молчит"
# Регрессия аудита хрупкости: невидимый байт и вариация формата гасили чтение молча.
g2="$("$L" open CRLF-1 autonomous)"
"$L" set CRLF-1 Исход blocked; "$L" set CRLF-1 Нехватка "не найден файл: src/app.ts"
sed -i 's/$/\r/' "$g2"
check "$("$L" get CRLF-1 Статус)" "открыт" "CRLF: get не тащит CR в значение"
check "$("$L" get CRLF-1 Исход)" "blocked" "CRLF: сверка Исхода с blocked не ломается"
check "$("$L" get CRLF-1 Режим)" "autonomous" "CRLF: сверка Режима не ломается"
check "$("$L" get CRLF-1 Нехватка)" "не найден файл: src/app.ts" "двоеточие в значении читается целиком"
check "$(printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; echo $?)" "0" "CRLF: терминал blocked с Нехваткой выпускает ход"
"$L" set CRLF-1 Новый-ключ y
check "$("$L" get CRLF-1 Новый-ключ)" "y" "CRLF: дописанный ключ читается"
check "$(awk '/^##/{print NR; exit}' "$g2")" "10" "CRLF: дописанный ключ лёг в шапку, не в конец файла"

# Событие хука: разбор строгий, вариации пробелов и вложенные одноимённые поля его не сбивают.
check "$(printf '%s' '{"cwd": "/home/u/Work my.proj", "source": "startup"}' | "$H/session-start.py" | grep -c 'цель CRLF-1')" "1" "событие с пробелами после двоеточий разобрано"
check "$(printf '%s' '{"cwd":"/home/u/Work my.proj","tool_input":{"cwd":"/nonexistent"},"source":"startup"}' | "$H/session-start.py" | grep -c 'цель CRLF-1')" "1" "вложенный одноимённый ключ не перебивает верхний"
check "$(printf 'не json' | "$H/session-start.py" 2>/dev/null)" "" "битое событие: хук старта не выдумывает цель"
"$L" set CRLF-1 Нехватка ""
check "$(printf '%s' "$SIN" | "$H/stop-guard.py" >/dev/null 2>&1; echo $?)" "2" "цель без терминала запирает ход"
check "$(printf 'не json' | "$H/stop-guard.py" >/dev/null 2>&1; echo $?)" "0" "битое событие: Stop не запирает ход навсегда"
"$L" close CRLF-1 complete

"$L" open PROJ-2 >/dev/null; "$L" open PROJ-3 >/dev/null
out="$(printf '%s' "$IN" | "$H/session-start.py")"
check "$(printf '%s' "$out" | grep -c 'открытая цель')" "2" "session-start: обе открытые цели перечислены"
check "$(printf '%s' "$out" | grep -c 'дефект')" "0" "session-start: число целей дефектом не объявляется (R5 нормирует треки, не цели)"
check "$(printf '%s' "$out" | grep -c 'close PROJ-2 complete')" "1" "session-start: совет закрывать цель несёт явный исход"
[ "$fail" = 0 ] && echo "ledger.test.sh: $n проверок, все прошли" || { echo "ledger.test.sh: есть провалы"; exit 1; }
