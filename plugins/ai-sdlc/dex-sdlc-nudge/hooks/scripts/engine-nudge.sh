#!/usr/bin/env bash
# Подталкивание к движку на рабочей просьбе.
#
# Почему хук, а не поле активации скилла: замер 23.08.2026 (tools/run-activation.js, sonnet,
# 2 прогона x 5 кейсов) - движок не поднялся ни разу из 10 ни при своём описании процесса, ни
# при поле, набранном из одних формулировок задач; в 9 запусках из 10 модель не вызвала вообще
# ни одного скилла. Механизм отбора скиллов идёт за справкой о предмете, а режим работы им не
# выбирается. Тот же прогон с этим хуком - движок поднимается, а на вопросе и мелкой правке нет.
#
# Почему текст инжекта не содержит реестра зон: дом реестра один - references/zone-registry.md
# движка. Копия здесь разошлась бы с ним молча, а движок и так резолвит зону сам (шаг 1 цикла).
#
# Почему фильтра по словам нет: условие неприменимости несёт сам текст, и модель его соблюдает
# (замер: «поправь опечатку», «какой у нас стек» - конвейер не поднят). Регулярка по глаголам
# давала бы ложные срабатывания там, где модель отсекает верно.
#
# Почему перечень работ идёт после признака, а не вместо него: вид работы, которого в перечне нет,
# оставался без ветки решения. Признак («довести до конца по названному порядку, с проверкой на
# выходе») решает, перечень держит узнаваемость формулировок, терминал закрывает остаток.
#
# Почему текст английский: он инструкция модели, не витрина каталога, и на кириллице тот же смысл
# стоит дороже токенами (правило русской витрины касается description, не инжекта).
set -uo pipefail

# Без jq поле cwd не разбирается, cd пропускается и git проверяется в рабочем каталоге самого
# хука - обычно он же и есть каталог сессии, так что деградация мягкая, но не гарантированная.
input=$(cat)

cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
[ -n "$cwd" ] && cd "$cwd" 2>/dev/null

# Вне git-репозитория конвейера нет: ветки, MR и тикеты - его опоры. Молчим, а не шумим.
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Pipeline work: carried to completion on your own, in a named order, verified at the end - implementation, bug fix, tests, MR review, review follow-up, stand acceptance, failure diagnosis, requirements, design, documentation, code overview. On such a request call Skill dex-sdlc:engine before acting on it; it resolves zone and track itself, do not name them in the call. Questions, explanations, discussion, and edits needing neither build nor review are not pipeline work - continue normally. Looks like work but the kind is unlisted - call the engine anyway."}}
JSON
