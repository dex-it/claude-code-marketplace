#!/usr/bin/env bash
# Сдача исхода прогона: возврат Workflow (stdin, JSON) -> файл трека и машинные строки цели.
# Суждение (исход, нехватка) приходит аргументами от главного потока; здесь только запись.
set -eu
H="$(cd "$(dirname "$0")" && pwd)"; L="$H/ledger.sh"
task=${1:-}; track=${2:-}; outcome=${3:-}; lack=${4:-}
usage() { echo "usage: finish.sh TASK feature|bugfix|review|review>delta complete|partial|blocked [НЕХВАТКА] < return.json" >&2; exit 64; }
[ -n "$task" ] && [ -n "$track" ] && [ -n "$outcome" ] || usage
case "$track" in feature|bugfix|review|'review>delta') ;; *) usage ;; esac
case "$outcome" in complete|partial|blocked) ;; *) usage ;; esac
command -v jq >/dev/null 2>&1 || { echo "finish.sh: нужен jq - без него разделы файла трека пишутся Edit по той же форме" >&2; exit 3; }
IN="$(cat)"
printf '%s' "$IN" | jq -e 'type == "object"' >/dev/null 2>&1 || { echo "finish.sh: stdin не JSON-объект, ничего не записано" >&2; exit 4; }
"$L" get "$task" "Статус" >/dev/null 2>&1 || { echo "finish.sh: цель $task не заведена (нет 00-goal.md)" >&2; exit 1; }
j() { printf '%s' "$IN" | jq -r "$1"; }

f="$("$L" dir "$task")/01-${track%%>*}.md"
[ "$outcome" = complete ] && st="закрыт" || st="открыт"
if [ -f "$f" ]; then
  n=$(( $(grep -c '^## Прогон ' "$f") + 1 )); sed -i "s|^Статус:.*|Статус: $st|" "$f"
else
  n=1; printf '# Трек: %s\n\ntrack=%s\nСтатус: %s\n' "$task" "$track" "$st" > "$f"
fi
{
  printf '\n## Прогон %s (%s, исход %s)\n\n### Петли\n' "$n" "$(date -Iseconds)" "$outcome"
  j '(.loops // {}) | to_entries[] | "- \(.key): \(.value)"'
  printf '\n### Исполнители\n'
  j '(.trail // []) | .[] | "- " + tojson'
  printf '\n### Решения\n'
  j '(.decisions // []) | .[] | "- " + tostring'
  j '(.degraded // []) | .[] | "- узел заменён: " + tostring'
  j '(.dropped // []) | .[] | "- снято \(.anchor): \(.reason)"'
  j '(.questions // []) | .[] | "- вопрос автору: " + tostring'
} >> "$f"

case "$outcome" in
  complete) "$L" close "$task" complete ;;
  partial)  "$L" set "$task" "Исход" partial ;;
  blocked)
    [ -n "$lack" ] || lack="$(j '.missing // empty')"
    [ -n "$lack" ] || lack="узел не вернул выход, шаг $(j '.where // "неизвестен"')"
    "$L" set "$task" "Исход" blocked; "$L" set "$task" "Нехватка" "$lack" ;;
esac
printf '%s\n' "$f"
