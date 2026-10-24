#!/usr/bin/env bash
# Гейт python3 для вызова из главного потока: имя скрипта в auto.md и тестах прежнее, счёт - в finish.py.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
command -v python3 >/dev/null 2>&1 || { echo "finish.sh: нужен python3 - без него исход прогона пишется Edit по форме 01-<трек>.md" >&2; exit 3; }
exec python3 "$H/finish.py" "$@"
