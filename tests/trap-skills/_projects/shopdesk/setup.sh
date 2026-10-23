#!/usr/bin/env bash
# Разворачивает мини-проект Shopdesk с историей в <dest>: стадии stages/* - коммиты main,
# branches/<имя>/* - коммиты ветки feature/<имя> от main. В конце ставит зависимости из
# package-lock.json только из кэша npm (сеть не нужна, браузеры Playwright не качаются).
# README.md и mines/ в <dest> не попадают.
# Использование: setup.sh <dest> [ветка для checkout]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; checkout="${2:-main}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
cd "$dest"
git init -q -b main
git config user.name "Shopdesk Team"; git config user.email "dev@shopdesk.example"
apply() { # $1 - каталог стадии
  (cd "$1" && find . -type f ! -name COMMIT ! -name DATE ! -name DELETE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  while IFS= read -r f; do rm -f "$dest/$f"; done < <([ -f "$1/DELETE" ] && cat "$1/DELETE" || true)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$1/DATE")" GIT_COMMITTER_DATE="$(cat "$1/DATE")" git commit -q -F "$1/COMMIT"
}
for s in "$here"/stages/*/; do apply "$s"; done
branch() { # $1 - каталог ветки
  local b="$1" name
  name="$(basename "$b")"
  local base=main
  [ -f "$b/BASE" ] && base="feature/$(cat "$b/BASE")" # BASE - ветка поверх другой ветки (кейсы ревью)
  git checkout -q -b "feature/$name" "$base"
  for c in "$b"*/; do [ -d "$c" ] && apply "$c"; done
  git checkout -q main
}
for b in "$here"/branches/*/; do [ -d "$b" ] && [ ! -f "$b/BASE" ] && branch "$b"; done
for b in "$here"/branches/*/; do [ -d "$b" ] && [ -f "$b/BASE" ] && branch "$b"; done # родители уже созданы
git checkout -q "$checkout"
# package-lock.json лежит в stages/1-api (исключение в корневом .gitignore): транзитивные версии не зависят от локального кэша npm.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --offline --ignore-scripts --no-audit --no-fund
