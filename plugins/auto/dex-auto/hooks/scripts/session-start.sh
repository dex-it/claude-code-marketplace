#!/usr/bin/env bash
# SessionStart: подъём открытой цели после startup / resume / compact (компонент 11, N3).
# `clear` в матчере нет намеренно (ledger.md T1): /clear - жест «забудь», всплывающая после него
# цель делает жест невыполнимым. Не дочинивать.
set -u
H="$(cd "$(dirname "$0")" && pwd)"
IN="$(cat)"
field() { if command -v jq >/dev/null 2>&1; then printf '%s' "$IN" | jq -r ".$1 // empty"; else printf '%s' "$IN" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; fi; }
src="$(field source)"; cwd="$(field cwd)"
case "${src:-startup}" in startup|resume|compact) ;; *) exit 0 ;; esac
export DEX_AUTO_CWD="${cwd:-$PWD}"
open="$("$H/ledger.sh" find)"
[ -n "$open" ] || exit 0
n=$(printf '%s\n' "$open" | wc -l)
[ "$n" -gt 1 ] && echo "dex-auto: дефект R5 - открыто целей: $n (в проекте допустима одна). Закрой лишние через ledger.sh close <TASK>."
while IFS=$'\t' read -r task dir; do
  goal="$(awk '/^## Цель/{f=1;next} f&&NF{print;exit}' "$dir/00-goal.md")"
  tracks="$(ls "$dir" 2>/dev/null | grep -E '^[0-9]{2}-' | grep -v '^00-' | tr '\n' ' ')"
  echo "dex-auto: открытая цель $task - ${goal:-(цель не заполнена)}. Ledger: $dir. Первое действие: Read $dir/00-goal.md и файлы трека ${tracks:-(треков нет)}; затем продолжай командой /dex-auto:auto $task продолжить либо закрой цель (ledger.sh close $task, при тупике - Исход: blocked и Нехватка:)."
done <<< "$open"
exit 0
