#!/bin/bash
# =============================================================================
# Autonomous Task Resume Reminder for Claude Code
# Part of dex-autonomous-task-resume plugin
#
# После компакта от dex-skill-autonomous-task в окне остаются первые 5000
# токенов последнего вызова скилла, а файл трека не переносится вовсе - без
# явного напоминания модель продолжает работу по обрезку. Задачи (TaskCreate)
# официально переживают компакт контекста (Claude Code docs: "Tasks persist
# across context compactions") и без CLAUDE_CODE_TASK_LIST_ID лежат в
# ~/.claude/tasks/<session_id>/<id>.json - session_id хук получает из stdin.
# Хук ищет незакрытый task-флаг движка (subject начинается с
# "autonomous-task: track=") в задачах ЭТОЙ сессии. Шаги возобновления не
# дублируются - хук отправляет к скиллу, иначе копия разойдётся с нормой.
# =============================================================================

if ! command -v jq &> /dev/null; then
  echo "Warning: jq not found, resume reminder disabled" >&2
  exit 0
fi

set +e

input=$(cat)
session_id=$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)

if [ -z "$session_id" ]; then
  exit 0
fi

tasks_dir="$HOME/.claude/tasks/$session_id"

if [ ! -d "$tasks_dir" ]; then
  exit 0
fi

flag_track=""
for task_file in "$tasks_dir"/*.json; do
  [ -f "$task_file" ] || continue
  subject=$(jq -r 'select(.status != "completed") | .subject // empty' "$task_file" 2>/dev/null)
  case "$subject" in
    "autonomous-task: track="*)
      flag_track="${subject#autonomous-task: track=}"
      break
      ;;
  esac
done

if [ -z "$flag_track" ]; then
  exit 0
fi

context=$(cat <<EOF
Обнаружен незакрытый task-флаг автономной задачи (dex-skill-autonomous-task), трек: ${flag_track}.

Компакт оставил в окне только начало движка, файл трека не перенесён вовсе - работа по обрезку
идёт без домов норм. Первым действием подними движок заново: Skill -> dex-skill-autonomous-task:autonomous-task.
Затем выполни его раздел "Возобновление" (там же путь к файлу трека ${flag_track}). До этого
никаких действий по задаче - ни правок, ни делегирования, ни ответов в трекер.
EOF
)

json_context=$(printf '%s' "$context" | jq -Rs . 2>/dev/null)

if [ -z "$json_context" ]; then
  echo "$context"
  exit 0
fi

cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": ${json_context}
  }
}
EOF
