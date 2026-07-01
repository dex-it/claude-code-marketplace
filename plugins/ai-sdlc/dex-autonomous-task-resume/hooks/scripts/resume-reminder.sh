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

set +e

input=$(cat)
session_id=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("session_id",""))' 2>/dev/null)

if [ -z "$session_id" ]; then
  exit 0
fi

tasks_dir="$HOME/.claude/tasks/$session_id"

if [ ! -d "$tasks_dir" ]; then
  exit 0
fi

flag_track=$(python3 - "$tasks_dir" <<'PYEOF' 2>/dev/null
import json, sys, os

tasks_dir = sys.argv[1]
for name in os.listdir(tasks_dir):
    if not name.endswith(".json"):
        continue
    path = os.path.join(tasks_dir, name)
    try:
        with open(path, "r") as f:
            task = json.load(f)
    except (OSError, json.JSONDecodeError):
        continue
    subject = task.get("subject", "")
    if task.get("status") != "completed" and subject.startswith("autonomous-task: track="):
        print(subject.split("track=", 1)[1].strip())
        break
PYEOF
)

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

json_context=$(printf '%s' "$context" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null)

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
