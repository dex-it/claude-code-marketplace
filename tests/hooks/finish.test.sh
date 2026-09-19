#!/usr/bin/env bash
# Регрессия finish.sh и ledger.py trail: возврат Workflow -> файл трека и машинные строки цели.
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
export CLAUDE_CONFIG_DIR="$T/cfg"; export DEX_AUTO_CWD="/home/u/Work/proj"
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }
L="$H/ledger.py"; F="$H/finish.sh"
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
check "$("$L" trail BUG-1 feature | grep -c '')" "2" "trail: строки исполнителей"
check "$("$L" trail BUG-1 review)" "" "trail: файла трека нет -> пусто"

"$L" open PR-7 >/dev/null
# без кавычек намеренно: это та форма, которую читает модель в usage и в auto.md
"$F" PR-7 review-delta partial <<< "$REV" >/dev/null
f="$("$L" dir PR-7)/01-review.md"
check "$(grep -c '^track=review-delta$' "$f")" "1" "finish: review-delta -> файл 01-review.md, track с дельтой"
check "$(grep -c '^Статус: открыт$' "$f")" "1" "finish: partial -> трек открыт"
check "$(grep -c '^- снято src/a.ts:10: закрыто коммитом abc$' "$f")" "1" "finish: dropped в Решения"
check "$(grep -c '^- вопрос автору: зачем retry 5?$' "$f")" "1" "finish: questions в Решения"
check "$("$L" get PR-7 Исход)" "partial" "finish: partial -> Исход partial, цель открыта"
check "$("$L" find | cut -f1)" "PR-7" "finish: partial не закрывает цель"
"$F" PR-7 review-delta complete <<< "$REV" >/dev/null
check "$(grep -c '^## Прогон 2 ' "$f")" "1" "finish: повторный вызов дописывает Прогон 2"
check "$(grep -c '^Статус: закрыт$' "$f")" "1" "finish: повторный вызов обновляет Статус трека"
check "$("$L" trail PR-7 review | grep -c '')" "2" "trail: исполнители обоих прогонов"

"$L" open F-2 >/dev/null
"$F" F-2 feature partial <<< '{"status":"partial","trail":[{"step":1}],"open_findings":[{"severity":"P1","anchor":"src/a.ts:10","text":"находка прогона 1"}]}' >/dev/null
"$F" F-2 feature partial <<< '{"status":"partial","trail":[{"step":2}],"open_findings":[{"severity":"P1","anchor":"src/b.ts:20","text":"находка прогона 2"}]}' >/dev/null
check "$("$L" findings F-2 feature)" "- [P1] src/b.ts:20: находка прогона 2" "findings: только прошлый прогон, находки прежних не всплывают"
check "$("$L" trail F-2 feature | grep -c '')" "2" "trail: накопление по всем прогонам - намеренная асимметрия с findings"
check "$("$L" findings F-2 review)" "" "findings: файла трека нет -> пусто"

"$L" open T-3 >/dev/null
"$F" T-3 bugfix blocked <<< '{"status":"blocked","where":"Reproduce","missing":"нет доступа к стенду"}' >/dev/null
check "$("$L" get T-3 Нехватка)" "нет доступа к стенду" "finish: blocked без аргумента -> Нехватка из .missing"
"$F" T-3 bugfix blocked "цель не подготовлена" <<< '{}' >/dev/null
check "$("$L" get T-3 Нехватка)" "цель не подготовлена" "finish: аргумент нехватки сильнее .missing"
"$F" T-3 bugfix blocked <<< '{"where":"Fix#2"}' >/dev/null
check "$("$L" get T-3 Нехватка)" "узел не вернул выход, шаг Fix#2" "finish: нет ни аргумента, ни .missing -> шаг where"
check "$("$L" get T-3 Исход)" "blocked" "finish: blocked -> Исход blocked"

"$L" open C-5 >/dev/null
"$F" C-5 feature partial <<< '{"loops":{"fix":1},"ctx":{"stack":"ts","test_cmd":"npm test","requirements":["R1 поле"]}}' >/dev/null
check "$("$L" ctx C-5 feature)" '{"stack":"ts","test_cmd":"npm test","requirements":["R1 поле"]}' "ctx: продукт разведки пишется и читается строкой JSON"
"$F" C-5 feature partial <<< '{"loops":{"fix":2},"ctx":{"stack":"ts","test_cmd":"npm run t"}}' >/dev/null
check "$("$L" ctx C-5 feature)" '{"stack":"ts","test_cmd":"npm run t"}' "ctx: читается разведка последнего прогона, не первого"
"$F" C-5 feature partial <<< '{"loops":{"fix":3}}' >/dev/null
check "$("$L" ctx C-5 feature)" '{"stack":"ts","test_cmd":"npm run t"}' "ctx: прогон без разведки прежнюю запись не затирает"
check "$("$L" ctx C-5 review)" "" "ctx: другого трека нет -> пусто"
"$L" open R-6 >/dev/null
"$F" R-6 bugfix partial <<< '{"loops":{"fix":1},"repro":{"root_cause":"src/a.ts:10 null"}}' >/dev/null
check "$("$L" ctx R-6 bugfix)" '{"root_cause":"src/a.ts:10 null"}' "ctx: bugfix отдаёт repro тем же разделом"
check "$(grep -n '^### ' "$("$L" dir C-5)/01-feature.md" | tail -2 | cut -d: -f2 | tr '\n' ' ')" "### Контекст ### Решения " "ctx: раздел Контекст стоит перед Решениями - те дописываются в конец файла"

"$L" open E-4 >/dev/null
"$F" E-4 feature complete <<< '{}' >/dev/null 2>&1; check "$?" "65" "finish: complete на пустом возврате -> отказ 65"
"$F" E-4 feature partial <<< '{"status":"partial"}' >/dev/null 2>&1; check "$?" "65" "finish: partial без loops и trail -> отказ 65"
check "$("$L" get E-4 Исход)" "" "finish: отказ на пустом возврате не пишет исход цели"
check "$(ls "$("$L" dir E-4)" | grep -c '^01-')" "0" "finish: отказ на пустом возврате не заводит файл трека"
"$F" E-4 feature partial <<< '{"loops":{"fix":1}}' >/dev/null; check "$("$L" get E-4 Исход)" "partial" "finish: один loops без trail - прогон был, partial проходит"
# Без python3 сдача не пишет: молчаливая запись половины разделов хуже отказа с названной причиной.
"$L" open N-8 >/dev/null
B="$T/bin"; mkdir -p "$B"
for u in bash sh env cat dirname cd; do x="$(type -P "$u")" && ln -sf "$x" "$B/$u"; done
check "$(PATH="$B" command -v python3)" "" "шим прячет python3"
err="$(PATH="$B" "$F" N-8 feature partial <<< "$DEV" 2>&1 >/dev/null)"; rc=$?
check "$rc" "3" "без python3: finish отказывает кодом 3"
check "$(printf '%s' "$err" | grep -c 'python3')" "1" "без python3: причина называет, чего не хватает"
check "$(ls "$("$L" dir N-8)" | grep -c '^01-')" "0" "без python3: файла трека нет"

[ "$fail" = 0 ] && echo "finish.test.sh: $n проверок, все прошли" || { echo "finish.test.sh: есть провалы"; exit 1; }
