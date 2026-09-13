#!/usr/bin/env bash
# Stop: терминал цели (компоненты 6, 8; N1 - потолок на самого сторожа, N3).
# Первая строка работы - гейт по открытой цели: без неё хук молчит (один stat, не текст в окне).
set -u
H="$(cd "$(dirname "$0")" && pwd)"
IN="$(cat)"
field() { if command -v jq >/dev/null 2>&1; then printf '%s' "$IN" | jq -r ".$1 // empty"; else printf '%s' "$IN" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; fi; }
cwd="$(field cwd)"; export DEX_AUTO_CWD="${cwd:-$PWD}"
open="$("$H/ledger.sh" find)"
[ -n "$open" ] || exit 0
L="$H/ledger.sh"; ceiling="$("$L" ceiling)"
while IFS=$'\t' read -r task dir; do
  outcome="$("$L" get "$task" "Исход")"; lack="$("$L" get "$task" "Нехватка")"
  mode="$("$L" get "$task" "Режим")"; waits="$("$L" get "$task" "Ожидает")"
  [ "$outcome" = "blocked" ] && [ -n "$lack" ] && continue
  [ "$mode" = "interactive" ] && [ "$waits" = "оператор" ] && continue
  blocks="$("$L" get "$task" "stop-блоков")"
  if [ "${blocks:-0}" -ge "$ceiling" ]; then
    "$L" set "$task" "Stop-потолок" "достигнут $(date -Iseconds)"
    continue
  fi
  k="$("$L" bump "$task" "stop-блоков")"
  echo "dex-auto: цель $task открыта ($dir/00-goal.md), стоп-блок $k из $ceiling. Остановка разрешена при одном из: Статус: закрыт (критерий «готово» подтверждён внешним фактом, ledger.sh close $task); Исход: blocked с непустой Нехватка:; Режим: interactive и Ожидает: оператор. Иначе продолжай трек." >&2
  exit 2
done <<< "$open"
exit 0
