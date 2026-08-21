#!/bin/bash
# =============================================================================
# SDLC Engine Resume Reminder for Claude Code
# Part of dex-sdlc-resume plugin
#
# После компакта от dex-sdlc:engine в окне остаются первые 5000 токенов
# последнего вызова скилла, а auto-ledger не переносится вовсе - без явного
# напоминания модель продолжает работу по обрезку. auto-ledger - единственный
# якорь возобновления движка ([[P-auto-ledger]] в SKILL.md движка): платформенные
# Task-tools для этого не используются - недоступны по умолчанию на новых
# моделях (Claude Code changelog 2.1.233, 14.08.2026).
#
# Хук вычисляет slug той же формулой, что и движок (git rev-parse
# --path-format=absolute --git-common-dir, без /.git, символы вне
# [A-Za-z0-9-] -> "-") и сканирует auto-ledger/ этого slug на файлы со
# строкой статуса "Статус: открыт" (буквальный контракт - см. P-auto-ledger).
# Формат самого auto-ledger (состав полей, трейл исполнителей) хук не
# дублирует - это норма движка, копия здесь разойдётся с ней при следующей
# правке формата.
# =============================================================================

if ! command -v jq &> /dev/null; then
  echo "Warning: jq not found, resume reminder disabled" >&2
  exit 0
fi

set +e

input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)

if [ -n "$cwd" ] && [ -d "$cwd" ]; then
  cd "$cwd" || exit 0
fi

git_common_dir=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)

if [ -z "$git_common_dir" ]; then
  exit 0
fi

repo_root="${git_common_dir%/.git}"
slug=$(printf '%s' "$repo_root" | sed 's/[^A-Za-z0-9-]/-/g')
config_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
ledger_dir="$config_dir/projects/$slug/auto-ledger"

if [ ! -d "$ledger_dir" ]; then
  exit 0
fi

open_ledgers=()
for ledger_file in "$ledger_dir"/*.md; do
  [ -f "$ledger_file" ] || continue
  if grep -qiE '^Статус:[[:space:]]*открыт' "$ledger_file" 2>/dev/null; then
    open_ledgers+=("$ledger_file")
  fi
done

if [ ${#open_ledgers[@]} -eq 0 ]; then
  exit 0
fi

if [ ${#open_ledgers[@]} -eq 1 ]; then
  ledger_path="${open_ledgers[0]}"
  context=$(cat <<EOF
Обнаружен незакрытый auto-ledger движка (dex-sdlc:engine): ${ledger_path}.

Компакт оставил в окне только начало движка, auto-ledger не перенесён вовсе - работа по обрезку
идёт без домов норм. Три действия по порядку, до них - никаких правок, делегирования и ответов в
трекер: (1) Skill -> dex-sdlc:engine; (2) Read ${ledger_path}; (3) по треку из шапки файла и
последней записи трейла - Skill на этот трек безусловно, и Skill на удержанный скилл тоже, если
канал этой записи "self".
EOF
)
else
  list=$(printf '%s\n' "${open_ledgers[@]}")
  context=$(cat <<EOF
В этой репе несколько незакрытых auto-ledger движка (dex-sdlc:engine) сразу - какой из них
принадлежит текущей сессии, хук по файлу определить не может:
${list}

До какой-либо работы: прочитай каждый кандидат, по содержимому (цель, трек, трейл) определи, какая
задача велась в ЭТОЙ сессии, и выполни для неё процедуру "Возобновление" движка. Остальные ledger
не трогай - они принадлежат другим сессиям/целям.
EOF
)
fi

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
