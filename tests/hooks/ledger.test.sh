#!/usr/bin/env bash
# Регрессия ledger и сторожей dex-auto на временном CLAUDE_CONFIG_DIR (долг ADR-0001: ловец адреса).
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
# Хук берёт каталог запуска из CLAUDE_PROJECT_DIR (P35): унаследованная от окружения увела бы ledger в чужой проект.
unset CLAUDE_PROJECT_DIR
# Владельца цели пишет скрипт из CLAUDE_CODE_SESSION_ID (T4): унаследованная от сессии, гоняющей тест, сделала бы её владельцем.
unset CLAUDE_CODE_SESSION_ID
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
# Владелец цели (T4 ledger.md): сессия последней записи ledger, Stop держит только его.
stop() { printf '{"session_id":"%s","cwd":"/home/u/Work my.proj","stop_hook_active":false}' "$1" | "$H/stop-guard.py" >/dev/null 2>&1; echo $?; }
check "$(stop S1)" "0" "owner: цель без владельца остановку не держит"
check "$(printf '%s' '{"cwd":"/home/u/Work my.proj","stop_hook_active":false}' | "$H/stop-guard.py" >/dev/null 2>&1; echo $?)" "0" "owner: цель без владельца и событие без session_id не держат"
CLAUDE_CODE_SESSION_ID=S1 "$L" get PROJ-1 Режим >/dev/null; check "$(stop S1)" "0" "owner: чтение владельцем не делает"
TASK=PROJ-1; CLAUDE_CODE_SESSION_ID=S1 "$L" set $TASK Режим autonomous
check "$(stop S1)" "2" "owner: set делает сессию владельцем при любой форме команды"
check "$(stop S2)" "0" "owner: чужая открытая цель остановку соседней сессии не держит"
printf '{"loops":{"coder":1}}' | CLAUDE_CODE_SESSION_ID=S2 "$H/finish.sh" PROJ-1 feature partial >/dev/null
check "$(stop S2)" "2" "owner: finish.sh другой сессии перехватывает цель"; check "$(stop S1)" "0" "owner: перехват снимает прежнего владельца"
"$L" set PROJ-1 Режим autonomous 2>"$T/err"; check "$(stop S2)" "2" "owner: запись без CLAUDE_CODE_SESSION_ID владельца не меняет"
check "$(grep -c "владелец цели PROJ-1 не записан" "$T/err")" "1" "owner: запись без CLAUDE_CODE_SESSION_ID названа в stderr"
"$L" dir NOPE-9 >/dev/null; CLAUDE_CODE_SESSION_ID=S1 "$L" set NOPE-9 Исход blocked 2>/dev/null
check "$([ -e "$("$L" root)/NOPE-9/owner" ] && echo есть || echo нет)" "нет" "owner: каталог без 00-goal.md владельца не получает"
rm -f "$(dirname "$f")/01-feature.md" "$(dirname "$f")/01-feature.findings.jsonl"; rm -rf "$("$L" root)/NOPE-9"
CLAUDE_CODE_SESSION_ID=S3 "$L" open OWN-1 >/dev/null; check "$(cat "$("$L" root)/OWN-1/owner")" "S3" "owner: open делает сессию владельцем"
CLAUDE_CODE_SESSION_ID=S4 "$L" close OWN-1 blocked; check "$(cat "$("$L" root)/OWN-1/owner")" "S4" "owner: close делает сессию владельцем"
export CLAUDE_CODE_SESSION_ID=S1; "$L" set PROJ-1 Исход ""
SIN='{"session_id":"S1","cwd":"/home/u/Work my.proj","stop_hook_active":false}'
err="$(printf '%s' "$SIN" | "$H/stop-guard.py" 2>&1 >/dev/null)"; rc=$?
check "$rc" "2" "stop-guard: открытая цель -> код 2"; check "$(printf '%s' "$err" | grep -c 'цель PROJ-1 открыта')" "1" "stop-guard: причина в stderr"
# Главный поток вошёл в дерево трека: cwd события - дерево, ledger ищется по каталогу запуска сессии (P35).
check "$(printf '%s' '{"cwd":"/home/u/Work my.proj-PROJ-1","source":"startup"}' | CLAUDE_PROJECT_DIR="/home/u/Work my.proj" "$H/session-start.py" | grep -c 'открытая цель PROJ-1')" "1" "session-start: в дереве трека цель найдена по каталогу запуска"
check "$(printf '%s' '{"session_id":"S1","cwd":"/home/u/Work my.proj-PROJ-1","stop_hook_active":false}' | CLAUDE_PROJECT_DIR="/home/u/Work my.proj" "$H/stop-guard.py" >/dev/null 2>&1; echo $?)" "2" "stop-guard: в дереве трека открытая цель найдена по каталогу запуска"
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
