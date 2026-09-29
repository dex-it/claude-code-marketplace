#!/usr/bin/env bash
# setup.sh <кейс> <каталог>: репозиторий кейса - база коммитом на main, ветка auto/<TASK>; правка кодера (change/) - коммитом на ней, если есть.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
case_dir=${1:-}
dest=${2:-}
[ -n "$case_dir" ] && [ -n "$dest" ] || { printf 'использование: %s <кейс> <каталог>\n' "$0" >&2; exit 2; }
case_dir=$(cd "$case_dir" && pwd)
[ -f "$case_dir/case.json" ] || { printf 'нет case.json: %s\n' "$case_dir" >&2; exit 2; }
[ -e "$dest" ] && { printf 'каталог занят: %s\n' "$dest" >&2; exit 2; }

field() { node -e 'const c=require(process.argv[1]); process.stdout.write(String(c[process.argv[2]] ?? ""))' "$case_dir/case.json" "$1"; }
base=$(field base)
if [ -n "$base" ]; then src="$here/../$base"; else src="$case_dir/base"; fi
[ -d "$src" ] || { printf 'нет базы: %s\n' "$src" >&2; exit 2; }

mkdir -p "$dest"
cp -r "$src/." "$dest/"
g() { git -C "$dest" -c user.name=probe -c user.email=probe@local "$@"; }
g init -q -b main
g add -A
g commit -q -m 'база кейса'
g checkout -q -b "auto/$(field task)"
if [ -d "$case_dir/change" ]; then
  cp -r "$case_dir/change/." "$dest/"
  g add -A
  g commit -q -m "$(field commit)"
fi
printf '%s\n' "$(cd "$dest" && pwd)"
