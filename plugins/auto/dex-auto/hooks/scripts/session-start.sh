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
# Числа открытых целей хук не судит: несколько живых целей - принятая цена адреса ledger (ledger.md, R2),
# а не дефект. R5 нормирует треки внутри цели, и сторожит его гейт команды /auto (issue #250).
while IFS=$'\t' read -r task dir; do
  goal="$(awk '/^## Цель/{f=1;next} f&&/^#/{exit} f&&NF&&!/^(Вид|Источник):/{print;exit}' "$dir/00-goal.md")"
  tracks="$(ls "$dir" 2>/dev/null | grep -E '^[0-9]{2}-' | grep -v '^00-' | tr '\n' ' ')"
  echo "dex-auto: открытая цель $task - ${goal:-(цель не заполнена)}. Ledger: $dir. Первое действие: Read $dir/00-goal.md и файлы трека ${tracks:-(треков нет)}; затем продолжай командой /dex-auto:auto $task продолжить; критерий «готово» подтверждён - закрой цель (ledger.sh close $task complete), при тупике цель не закрывай, а назови нехватку (ledger.sh set $task Исход blocked и ledger.sh set $task Нехватка <текст>)."
done <<< "$open"
exit 0
