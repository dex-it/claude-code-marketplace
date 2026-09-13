#!/usr/bin/env bash
# Единственный читатель и писатель машинных строк ledger (artifacts.md, «Один парсер»).
# Адрес: <config>/projects/<slug>/ledger/<TASK>/00-goal.md (ADR-0001 rev.6, ledger.md R1-R2).
# <slug> - рабочий каталог, каждый символ вне [A-Za-z0-9-] заменён на "-"; та же формула,
# которой host именует папку проекта. Расхождение с host наблюдается только чтением (ADR, долг 2).
set -eu

CONFIG="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CWD="${DEX_AUTO_CWD:-$PWD}"
STOP_CEILING=3

slug() { printf '%s' "$1" | sed 's/[^A-Za-z0-9-]/-/g'; }
root() { printf '%s/projects/%s/ledger' "$CONFIG" "$(slug "$CWD")"; }
goal_file() { printf '%s/%s/00-goal.md' "$(root)" "$(slug "$1")"; }

get_key() { # file key -> value ("" если строки нет)
  sed -n "s/^$2: *//p" "$1" | head -n 1
}
set_key() { # file key value -> заменить строку или дописать в шапку (перед первой пустой строкой после заголовка)
  local f=$1 k=$2 v=$3
  # Ключ и значение едут через ENVIRON. Не `sed -i`: без суффикса это GNU-форма, BSD sed (macOS) принимает
  # выражение за суффикс и падает. Не текстом в выражение sed: в замене `&` означает весь матч, `|` - разделитель.
  # Не `awk -v`: оно разбирает escape-последовательности и съедает `\1`, `\&`, `C:\Users`. ENVIRON отдаёт байт в байт.
  if grep -q "^$k:" "$f"; then
    k="$k" v="$v" awk 'BEGIN { k = ENVIRON["k"]; v = ENVIRON["v"] } !done && index($0, k ":") == 1 { print k ": " v; done = 1; next } { print }' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  else
    k="$k" v="$v" awk 'BEGIN { line = ENVIRON["k"] ": " ENVIRON["v"] } /^[^ #][^:]*: / { seen=1 } seen && !done && /^$/ { print line; done=1 } { print } END { if (!done) print line }' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  fi
}

cmd=${1:-}; shift || true
case "$cmd" in
  root) root ;;
  dir)  d="$(root)/$(slug "$1")"; mkdir -p "$d"; printf '%s\n' "$d" ;;
  open) # open TASK MODE -> путь 00-goal.md; существующий файл не перезаписывается
    task=$1; mode=${2:-autonomous}; d="$(root)/$(slug "$task")"; f="$d/00-goal.md"; mkdir -p "$d"
    if [ ! -f "$f" ]; then
      printf '# Цель: %s\n\nСтатус: открыт\nРежим: %s\nИсход: \nНехватка: \nОжидает: \nstop-блоков: 0\n\n## Цель\n\n## Критерий «готово»\n\n## Граница\n\n## Решения\n' "$task" "$mode" > "$f"
    fi
    printf '%s\n' "$f" ;;
  find) # -> строки "TASK<TAB>путь папки" для целей со Статус: открыт
    r="$(root)"; [ -d "$r" ] || exit 0
    for f in "$r"/*/00-goal.md; do
      [ -f "$f" ] || continue
      grep -q '^Статус: открыт$' "$f" && printf '%s\t%s\n' "$(basename "$(dirname "$f")")" "$(dirname "$f")"
    done; exit 0 ;;
  get)  f="$(goal_file "$1")"; [ -f "$f" ] || exit 1; get_key "$f" "$2" ;;
  set)  f="$(goal_file "$1")"; [ -f "$f" ] || exit 1; set_key "$f" "$2" "$3" ;;
  bump) f="$(goal_file "$1")"; [ -f "$f" ] || exit 1; n=$(get_key "$f" "$2"); n=$(( ${n:-0} + 1 )); set_key "$f" "$2" "$n"; printf '%s\n' "$n" ;;
  close) f="$(goal_file "$1")"; [ -f "$f" ] || exit 1; set_key "$f" "Исход" "${2:-complete}"; set_key "$f" "Статус" "закрыт" ;;
  ceiling) printf '%s\n' "$STOP_CEILING" ;;
  trail) # trail TASK TRACK -> строки всех разделов "### Исполнители" файла трека; файла нет - пусто
    f="$(root)/$(slug "$1")/01-${2%-delta}.md"; [ -f "$f" ] || exit 0
    awk '/^### Исполнители/{p=1;next} /^#/{p=0} p&&NF' "$f" ;;
  findings) # findings TASK TRACK -> строки раздела "### Открытые находки" ПОСЛЕДНЕГО прогона; файла нет - пусто
    # Накопитель сбрасывается на каждом "## Прогон": контракт возобновления - находки прошлого прогона, а не
    # вся история трека, иначе кодеру едут находки, закрытые прогонов назад, и pending гонит лишний круг
    # правки на зелёном дереве. У trail накопление по всем прогонам намеренное - это перечень сделанного.
    f="$(root)/$(slug "$1")/01-${2%-delta}.md"; [ -f "$f" ] || exit 0
    awk '/^## Прогон /{b=""} /^### Открытые находки/{p=1;next} /^#/{p=0} p&&NF{b=b $0 "\n"} END{printf "%s", b}' "$f" ;;
  *) echo "usage: ledger.sh root|dir TASK|open TASK [MODE]|find|get TASK KEY|set TASK KEY VALUE|bump TASK KEY|close TASK [OUTCOME]|ceiling|trail TASK TRACK|findings TASK TRACK" >&2; exit 64 ;;
esac
