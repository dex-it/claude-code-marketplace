#!/usr/bin/env bash
# setup.sh <фикстура> <каталог>: репозиторий фикстуры + подготовленная цель в ledger живого прогона.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
fixture=${1:-}
dest=${2:-}

if [ -z "$fixture" ] || [ -z "$dest" ]; then
  printf 'использование: %s <фикстура> <каталог>\nдоступные: %s\n' "$0" \
    "$(cd "$here" && find . -mindepth 2 -maxdepth 2 -name goal.md -printf '%h\n' | sed 's|^\./||' | sort | tr '\n' ' ')" >&2
  exit 2
fi

src="$here/$fixture"
[ -f "$src/goal.md" ] || { printf 'фикстуры нет: %s\n' "$src" >&2; exit 2; }
[ -e "$dest" ] && { printf 'каталог занят: %s\n' "$dest" >&2; exit 2; }

task=$(sed -n '1s/^# Цель: //p' "$src/goal.md")
[ -n "$task" ] || { printf 'в goal.md нет строки "# Цель: TASK"\n' >&2; exit 2; }

mkdir -p "$dest"
cp -r "$src/repo/." "$dest/"
dest=$(cd "$dest" && pwd)

git -C "$dest" init -q -b main
git -C "$dest" add -A
git -C "$dest" -c user.name=probe -c user.email=probe@local commit -q -m 'probe fixture: базовое состояние'

# Стоп-линия push проверяема только против настоящего отказа удалённой стороны.
if [ -f "$src/origin-blocked" ]; then
  origin="$dest.origin.git"
  rm -rf "$origin"
  git init -q --bare "$origin"
  printf '#!/bin/sh\necho "push заблокирован фикстурой" >&2\nexit 1\n' > "$origin/hooks/pre-receive"
  chmod +x "$origin/hooks/pre-receive"
  git -C "$dest" remote add origin "$origin"
fi

# Та же формула слага, что в hooks/scripts/ledger.py: символ вне [A-Za-z0-9-] -> "-".
slug=$(printf '%s' "$dest" | sed 's/[^A-Za-z0-9-]/-/g')
ledger="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/$slug/ledger/$task"
mkdir -p "$ledger"
cp "$src/goal.md" "$ledger/00-goal.md"

printf 'дерево:  %s\n' "$dest"
printf 'ledger:  %s\n' "$ledger"
printf 'задача:  %s (%s)\n' "$task" "$(sed -n 's/^Вид: //p' "$src/goal.md")"
[ -f "$src/origin-blocked" ] && printf 'origin:  %s (push отбивается pre-receive)\n' "$dest.origin.git"
exit 0
