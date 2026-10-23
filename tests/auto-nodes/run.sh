#!/usr/bin/env bash
# run.sh <узел> <каталог> <кейс:вариант:повтор>...: прогон вариантов узла на кейсах, каждый - своим claude -p в своём репозитории.
# Вариант - ключ таблицы NODES в <узел>/node.js. Параллельность - AUTO_NODES_JOBS (дефолт 6).
# Повтор - число либо диапазон N..M: `c:v:1..3` раскрывается в прогоны `c:v:1`, `c:v:2`, `c:v:3`.
# AUTO_NODES_DRY_RUN=1 печатает раскрытые прогоны и выходит, ничего не создавая и не запуская (claude и timeout не нужны).
# AUTO_NODES_PLUGINS - каталоги плагинов через пробел, каждый уходит в claude как --plugin-dir: контроль каталога и
# стековые скиллы, которых нет в профиле запуска (на чистой машине узел-контроль и скилл иначе недоступны).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
node_name=${1:-}; out=${2:-}
[ -n "$node_name" ] && [ -n "$out" ] && [ $# -ge 3 ] || { printf 'использование: %s <узел> <каталог> <кейс:вариант:повтор>...\n' "$0" >&2; exit 2; }
shift 2

# Раскрытие повтора N..M в отдельные прогоны. Без {N..M} и seq: на bash 3.2 (macOS) скобки не берут переменные.
specs=()
for spec in "$@"; do
  IFS=: read -r c v n <<< "$spec"
  case $n in
    *..*)
      lo=${n%%..*}; hi=${n#*..}
      case "$lo$hi" in *[!0-9]*) lo=; esac
      [ -n "$lo" ] && [ -n "$hi" ] && [ "$((10#$lo))" -le "$((10#$hi))" ] \
        || { printf 'run.sh: повтор «%s» в «%s» - нужно N..M из чисел, N не больше M\n' "$n" "$spec" >&2; exit 2; }
      i=$((10#$lo))
      while [ "$i" -le "$((10#$hi))" ]; do specs+=("$c:$v:$i"); i=$((i + 1)); done ;;
    *) specs+=("$spec") ;;
  esac
done
if [ -n "${AUTO_NODES_DRY_RUN:-}" ]; then printf '%s\n' "${specs[@]}"; exit 0; fi

mkdir -p "$out"; out=$(cd "$out" && pwd)
plugin=$(cd "$here/../../plugins/auto/dex-auto" && pwd)
to=$(command -v timeout || command -v gtimeout) || { printf 'run.sh: нет timeout (GNU coreutils; на macOS - gtimeout из brew coreutils)\n' >&2; exit 2; }
# Список каталогов - строка с переводом строки между путями (массив в export -f не передать): абсолютный путь с пробелом остаётся одним аргументом.
extra=
for p in ${AUTO_NODES_PLUGINS:-}; do
  [ -d "$p" ] || { printf 'run.sh: нет каталога плагина: %s\n' "$p" >&2; exit 2; }
  extra="${extra:+$extra$'\n'}$(cd "$p" && pwd)"
done
tmp="${CLAUDE_CODE_TMPDIR:-${TMPDIR:-${TMP:-${TEMP:-/tmp}}}}/claude-$(id -u)"
node "$here/build.mjs" "$node_name" "$out/workflow.js" >/dev/null

one() {
  IFS=: read -r c v n <<< "$1"
  id="$c-$v-$n"; d="$out/$id"
  [ -e "$d" ] && { printf '%s: занят, пропуск\n' "$id"; return 0; }
  mkdir -p "$d"
  # set -eu в функцию под xargs bash -c не наследуется: пустой repo дал бы `cd ""`, на bash 3.2 это успех в текущем каталоге.
  repo=$("$here/setup.sh" "$here/$node_name/$c" "$d/repo") || { printf '%s: setup упал\n' "$id"; return 1; }
  [ -d "$repo" ] || { printf '%s: setup не отдал каталог\n' "$id"; return 1; }
  pd=(); if [ -n "$extra" ]; then while IFS= read -r p; do pd+=(--plugin-dir "$p"); done <<< "$extra"; fi
  args=$(printf '{"case": "%s", "cwd": "%s", "node": "%s", "base": "%s", "head": "%s"}' "$c" "$repo" "$v" "$(git -C "$repo" rev-parse main)" "$(git -C "$repo" rev-parse HEAD)")

  (cd "$repo" && CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 "$to" 3000 claude -p "Прогон зонда. Вызови Workflow со scriptPath $out/workflow.js и args $args.
Он идёт в фоне: дождись возврата в этом же ходе циклом until в Bash (sleep 20 между проверками) по файлу вывода задачи <Task ID>.output - ищи find $tmp -name '<Task ID>.output'; готов - файл непуст и разбирается как JSON. Потолок ожидания 45 минут. Затем выведи содержимое файла дословно, без пересказа. Файлов не правь." \
    --model sonnet --dangerously-skip-permissions --plugin-dir "$plugin" ${pd[@]+"${pd[@]}"} --output-format json > "$d/out.json" 2> "$d/err.log" < /dev/null; echo "exit $?" >> "$d/err.log")
  printf '%s: %s\n' "$id" "$(tail -1 "$d/err.log")"
}
export -f one; export here node_name out plugin tmp to extra
printf '%s\n' "${specs[@]}" | xargs -P "${AUTO_NODES_JOBS:-6}" -I{} bash -c 'one "$@"' _ {}
