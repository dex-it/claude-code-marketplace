#!/usr/bin/env bash
# Регрессия finish.sh и ledger.sh trail: возврат Workflow -> файл трека и машинные строки цели.
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T/cfg"; export DEX_AUTO_CWD="/home/u/Work/proj"
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }
L="$H/ledger.sh"; F="$H/finish.sh"
DEV='{"status":"complete","loops":{"fix":1,"review":2,"review_fix":1},"trail":[{"step":1,"doer":"Explore","status":"complete"},{"step":2,"attempt":1,"doer":"dex-ts-fullstack-coder:ts-fullstack-assistant","status":"complete"}],"degraded":["верификатор: general-purpose"],"decisions":["R3: выбран split по дефису"],"missing":""}'
REV='{"status":"partial","where":"часть тредов не опубликована","loops":{"review":1,"falsify":1},"trail":[{"step":2,"doer":"dex-mr-reviewer:mr-reviewer"}],"degraded":[],"dropped":[{"anchor":"src/a.ts:10","reason":"закрыто коммитом abc"}],"questions":["зачем retry 5?"]}'

"$F" BUG-1 feature complete <<< "$DEV" >/dev/null; rc=$?
check "$rc" "1" "finish: цели нет -> код 1, ничего не пишет"
g="$("$L" open BUG-1 autonomous)"; d="$(dirname "$g")"
echo "не json" | "$F" BUG-1 feature complete >/dev/null 2>&1; check "$?" "4" "finish: невалидный JSON -> код 4"
check "$(ls "$d" | grep -c '^01-')" "0" "finish: при коде 4 файла трека нет"
"$F" BUG-1 feature nope <<< "$DEV" >/dev/null 2>&1; check "$?" "64" "finish: неизвестный исход -> usage 64"
out="$("$F" BUG-1 feature complete <<< "$DEV")"; check "$out" "$d/01-feature.md" "finish: печатает путь файла трека"
f="$d/01-feature.md"
check "$(grep -c '^track=feature$' "$f")" "1" "finish: строка track="
check "$(grep -c '^Статус: закрыт$' "$f")" "1" "finish: complete -> Статус трека закрыт"
check "$(grep -c '^## Прогон 1 (.*исход complete)$' "$f")" "1" "finish: заголовок прогона с исходом"
check "$(grep -c '^- fix: 1$' "$f")" "1" "finish: петли из .loops"
check "$(grep -c '^- {"step":2,' "$f")" "1" "finish: исполнители построчно компактным JSON"
check "$(grep -c '^- R3: выбран split по дефису$' "$f")" "1" "finish: decisions в Решения"
check "$(grep -c '^- узел заменён: верификатор' "$f")" "1" "finish: degraded с префиксом"
check "$("$L" get BUG-1 Исход)" "complete" "finish: complete закрывает цель с Исходом"
check "$("$L" find)" "" "finish: цель исчезла из find"
check "$("$L" trail BUG-1 feature | wc -l)" "2" "trail: строки исполнителей"
check "$("$L" trail BUG-1 review)" "" "trail: файла трека нет -> пусто"

"$L" open PR-7 >/dev/null
"$F" PR-7 'review>delta' partial <<< "$REV" >/dev/null
f="$("$L" dir PR-7)/01-review.md"
check "$(grep -c '^track=review>delta$' "$f")" "1" "finish: review>delta -> файл 01-review.md, track с дельтой"
check "$(grep -c '^Статус: открыт$' "$f")" "1" "finish: partial -> трек открыт"
check "$(grep -c '^- снято src/a.ts:10: закрыто коммитом abc$' "$f")" "1" "finish: dropped в Решения"
check "$(grep -c '^- вопрос автору: зачем retry 5?$' "$f")" "1" "finish: questions в Решения"
check "$("$L" get PR-7 Исход)" "partial" "finish: partial -> Исход partial, цель открыта"
check "$("$L" find | cut -f1)" "PR-7" "finish: partial не закрывает цель"
"$F" PR-7 'review>delta' complete <<< "$REV" >/dev/null
check "$(grep -c '^## Прогон 2 ' "$f")" "1" "finish: повторный вызов дописывает Прогон 2"
check "$(grep -c '^Статус: закрыт$' "$f")" "1" "finish: повторный вызов обновляет Статус трека"
check "$("$L" trail PR-7 review | wc -l)" "2" "trail: исполнители обоих прогонов"

"$L" open T-3 >/dev/null
"$F" T-3 bugfix blocked <<< '{"status":"blocked","where":"Reproduce","missing":"нет доступа к стенду"}' >/dev/null
check "$("$L" get T-3 Нехватка)" "нет доступа к стенду" "finish: blocked без аргумента -> Нехватка из .missing"
"$F" T-3 bugfix blocked "цель не подготовлена" <<< '{}' >/dev/null
check "$("$L" get T-3 Нехватка)" "цель не подготовлена" "finish: аргумент нехватки сильнее .missing"
"$F" T-3 bugfix blocked <<< '{"where":"Fix#2"}' >/dev/null
check "$("$L" get T-3 Нехватка)" "узел не вернул выход, шаг Fix#2" "finish: нет ни аргумента, ни .missing -> шаг where"
check "$("$L" get T-3 Исход)" "blocked" "finish: blocked -> Исход blocked"
[ "$fail" = 0 ] && echo "finish.test.sh: $n проверок, все прошли" || { echo "finish.test.sh: есть провалы"; exit 1; }
