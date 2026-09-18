#!/usr/bin/env bash
# Stop: терминал цели (компоненты 6, 8; N3). Своего потолка у сторожа нет: повторные блоки одного
# хода считает и снимает платформа (CLAUDE_CODE_STOP_HOOK_BLOCK_CAP), счётчик в ledger был бы вторым
# учётом того же и терял бы потолок при любом отказе записи.
# Первая строка работы - гейт по открытой цели: без неё хук молчит (один stat, не текст в окне).
set -u
H="$(cd "$(dirname "$0")" && pwd)"
IN="$(cat)"
field() { if command -v jq >/dev/null 2>&1; then printf '%s' "$IN" | jq -r ".$1 // empty"; else printf '%s' "$IN" | sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; fi; }
cwd="$(field cwd)"; export DEX_AUTO_CWD="${cwd:-$PWD}"
L="$H/ledger.sh"
open="$("$L" find)"
[ -n "$open" ] || exit 0
while IFS=$'\t' read -r task dir; do
  outcome="$("$L" get "$task" "Исход")"; lack="$("$L" get "$task" "Нехватка")"
  mode="$("$L" get "$task" "Режим")"; waits="$("$L" get "$task" "Ожидает")"
  [ "$outcome" = "blocked" ] && [ -n "$lack" ] && continue
  # Сверка префиксом, не равенством: поле несёт перечислимое значение, а уточнение причины дописывают
  # следом, и строгое равенство блокировало ход в том самом состоянии, которое разрешает (issue #250).
  case "$waits" in оператор*) [ "$mode" = "interactive" ] && continue ;; esac
  echo "dex-auto: цель $task открыта ($dir/00-goal.md). Остановка разрешена при одном из: Статус: закрыт (критерий «готово» подтверждён внешним фактом, ledger.sh close $task); Исход: blocked с непустой Нехватка:; Режим: interactive и Ожидает: оператор (значение перечислимое, уточнение причины - следом за словом). Критерий не подтверждён - цель не закрывай: ledger.sh set $task Исход blocked и ledger.sh set $task Нехватка <текст>. Иначе продолжай трек." >&2
  exit 2
done <<< "$open"
exit 0
