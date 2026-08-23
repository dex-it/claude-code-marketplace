#!/bin/bash
# =============================================================================
# SDLC Engine Resume Reminder for Claude Code
# Part of dex-sdlc-resume plugin
#
# Два события платформы теряют рабочий контекст по-разному, и текст напоминания
# у них разный (source из stdin):
#   compact - в окне остаются первые 5000 токенов последнего вызова каждого
#             скилла (бюджет 25000 на все, заполняется от свежего к старому),
#             auto-ledger не переносится вовсе. Нужна процедура "Возобновление"
#             целиком, до неё - никакой работы.
#   resume  - транскрипт восстановлен, но реаттач скиллов не проводится, а мир
#             за время паузы ушёл: ветки, MR, статусы трекера. Нужна сверка с
#             ground truth, а не перезапуск процедуры с нуля.
#
# auto-ledger - единственный якорь возобновления движка ([[P-auto-ledger]] в
# SKILL.md движка): платформенные Task-tools для этого не используются -
# недоступны по умолчанию на новых моделях (Claude Code changelog 2.1.233,
# 14.08.2026).
#
# Хук вычисляет slug той же формулой, что и движок (git rev-parse
# --path-format=absolute --git-common-dir, без /.git, символы вне
# [A-Za-z0-9-] -> "-") и сканирует auto-ledger/ этого slug на файлы со
# строкой статуса "Статус: открыт" (буквальный контракт - см. P-auto-ledger).
# Формат самого auto-ledger (состав полей, трейл исполнителей, действующие
# нормы) хук не дублирует - это норма движка, копия здесь разойдётся с ней
# при следующей правке формата.
# =============================================================================

if ! command -v jq &> /dev/null; then
  echo "Warning: jq not found, resume reminder disabled" >&2
  exit 0
fi

set +e

input=$(cat)
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)
source_kind=$(printf '%s' "$input" | jq -r '.source // empty' 2>/dev/null)

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

single_path="${open_ledgers[0]}"
all_paths=$(printf '%s\n' "${open_ledgers[@]}")

# Терминал на каждой ветке source. Пусто - трактуем как компакт (поведение по
# умолчанию сохраняется, если поле однажды перестанет приходить); startup,
# clear и fork не наши: /clear и новая сессия - намеренно чистое окно, форк
# наследует контекст целиком. Матчер их и не пускает, ветка держит границу на
# случай его расширения.
case "$source_kind" in
  compact|"" ) ;;
  resume ) ;;
  * ) exit 0 ;;
esac

if [ "$source_kind" = "resume" ]; then
  if [ ${#open_ledgers[@]} -eq 1 ]; then
    context=$(cat <<EOF
Сессия возобновлена, а auto-ledger движка (dex-sdlc:engine) не закрыт: ${single_path}.

Транскрипт вернулся, но скиллы после resume не реаттачатся, и состояние мира за паузу могло уйти.
До продолжения работы: (1) Read ${single_path} - что сделано, что в полёте, какой шаг прерван;
(2) сверь с ground truth - целевая ветка, открытые MR, статусы в трекере, живой прогон
сборки/тестов; расхождение с ledger устрани сразу. Продолжаешь работу по движку или треку -
перевызови их (Skill), тела в окне могли остаться усечёнными от прежней свёртки.
EOF
)
  else
    context=$(cat <<EOF
Сессия возобновлена, а в этой репе несколько незакрытых auto-ledger движка (dex-sdlc:engine):
${all_paths}

Какой из них принадлежит этой сессии, хук по файлу определить не может. Работаешь по одной из этих
целей - прочитай нужный ledger, сверь его с ground truth (ветка, MR, статусы трекера) и только
потом продолжай. Остальные ledger не трогай - они принадлежат другим сессиям/целям.
EOF
)
  fi
elif [ ${#open_ledgers[@]} -eq 1 ]; then
  context=$(cat <<EOF
Обнаружен незакрытый auto-ledger движка (dex-sdlc:engine): ${single_path}.

Компакт оставил в окне только начало движка, auto-ledger не перенесён вовсе - работа по обрезку
идёт без домов норм. Два действия немедленно, до них - никаких правок, делегирования и ответов в
трекер: (1) Skill -> dex-sdlc:engine; (2) Read ${single_path}. Дальше - по разделу "Возобновление"
движка: он вернётся в окно целиком первым действием, и порядок подъёма трека и действующих норм
берётся оттуда, а не по памяти.
EOF
)
else
  context=$(cat <<EOF
В этой репе несколько незакрытых auto-ledger движка (dex-sdlc:engine) сразу - какой из них
принадлежит текущей сессии, хук по файлу определить не может:
${all_paths}

До какой-либо работы: Skill -> dex-sdlc:engine, прочитай каждый кандидат, по содержимому (цель,
трек, трейл) определи, какая задача велась в ЭТОЙ сессии, и выполни для неё процедуру
"Возобновление" движка. Остальные ledger не трогай - они принадлежат другим сессиям/целям.
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
