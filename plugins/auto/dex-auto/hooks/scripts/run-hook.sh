#!/usr/bin/env bash
# Гейт python3: у Stop единственный безопасный исход отказа - пропуск, иначе ход нечем закончить, у PreToolUse - deny.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
hook=${1:-}

if command -v python3 >/dev/null 2>&1; then exec python3 "$H/$hook.py"; fi

IN="$(cat)"
case "$hook" in
  tree-guard)
    case "$IN" in *'"workflow-subagent"'*)
      printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"dex-auto: движку нужен python3, в PATH его нет - изоляция дерева трека не проверяется. Поставь python3 либо выключи плагин dex-auto."}}' ;;
    esac ;;
  stop-guard)    echo "dex-auto: нет python3 - терминал цели не проверен, остановка разрешена" >&2 ;;
  session-start) echo "dex-auto: нет python3 - открытая цель не поднята" >&2 ;;
esac
exit 0
