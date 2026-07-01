#!/bin/bash
# =============================================================================
# Autonomous Task Resume Reminder for Claude Code
# Part of dex-autonomous-task-resume plugin
#
# После компакта dex-skill-autonomous-task теряет из контекста SKILL.md и файл
# трека - без явного напоминания модель может не вспомнить запустить процедуру
# "Возобновление". Задачи (TaskCreate) официально переживают компакт контекста
# (Claude Code docs: "Tasks persist across context compactions") и без
# CLAUDE_CODE_TASK_LIST_ID лежат в ~/.claude/tasks/<session_id>/<id>.json -
# session_id хук получает из stdin. Хук ищет незакрытый task-флаг движка
# (subject начинается с "autonomous-task: track=") в задачах ЭТОЙ сессии.
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

Компакт мог унести SKILL.md и файл трека из контекста. Прежде чем продолжать - выполни процедуру
"Возобновление" из dex-skill-autonomous-task:autonomous-task: перечитай SKILL.md целиком и
tracks/<трек>.md, восстанови состояние из план-файла и тасклиста, сверь ground truth
(ветка/MR/статусы трекера/прогон), сверь синхрон трекера с тасклистом.
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
