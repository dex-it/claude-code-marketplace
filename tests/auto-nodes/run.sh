#!/usr/bin/env bash
# run.sh <узел> <каталог> <кейс:вариант:повтор>...: прогон вариантов узла на кейсах, каждый - своим claude -p в своём репозитории.
# Вариант - ключ таблицы NODES в <узел>/node.js. Параллельность - AUTO_NODES_JOBS (дефолт 6).
set -eu

here=$(cd "$(dirname "$0")" && pwd)
node_name=${1:-}; out=${2:-}
[ -n "$node_name" ] && [ -n "$out" ] && [ $# -ge 3 ] || { printf 'использование: %s <узел> <каталог> <кейс:вариант:повтор>...\n' "$0" >&2; exit 2; }
shift 2
mkdir -p "$out"; out=$(cd "$out" && pwd)
plugin=$(cd "$here/../../plugins/auto/dex-auto" && pwd)
node "$here/build.mjs" "$node_name" "$out/workflow.js" >/dev/null

one() {
  IFS=: read -r c v n <<< "$1"
  id="$c-$v-$n"; d="$out/$id"
  [ -e "$d" ] && { printf '%s: занят, пропуск\n' "$id"; return 0; }
  mkdir -p "$d"
  repo=$("$here/setup.sh" "$here/$node_name/$c" "$d/repo")
  args=$(printf '{"case": "%s", "cwd": "%s", "node": "%s"}' "$c" "$repo" "$v")
  (cd "$repo" && CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 timeout 3000 claude -p "Прогон зонда. Вызови Workflow со scriptPath $out/workflow.js и args $args.
Он идёт в фоне: дождись возврата в этом же ходе циклом until в Bash (sleep 20 между проверками) по файлу вывода задачи <Task ID>.output - ищи find /tmp/claude-1000 -name '<Task ID>.output'; готов - файл непуст и разбирается как JSON. Потолок ожидания 45 минут. Затем выведи содержимое файла дословно, без пересказа. Файлов не правь." \
    --model sonnet --dangerously-skip-permissions --plugin-dir "$plugin" --output-format json > "$d/out.json" 2> "$d/err.log" < /dev/null; echo "exit $?" >> "$d/err.log")
  printf '%s: %s\n' "$id" "$(tail -1 "$d/err.log")"
}
export -f one; export here node_name out plugin
printf '%s\n' "$@" | xargs -P "${AUTO_NODES_JOBS:-6}" -I{} bash -c 'one "$@"' _ {}
