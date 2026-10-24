#!/usr/bin/env bash
# Разворачивает мини-проект Classmate в <dest>: stages/* - коммиты main, branches/<имя>/* - ветка feature/<имя> от main.
# Использование: setup.sh <dest> [ветка для checkout]
set -euo pipefail; shopt -s nullglob
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; checkout="${2:-main}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
cd "$dest"
git init -q -b main
git config user.name "Classmate Team"; git config user.email "team@classmate.example"
apply() { # $1 - каталог стадии или коммита ветки
  (cd "$1" && find . -type f ! -name COMMIT ! -name DATE ! -name DELETE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  while IFS= read -r f; do rm -f "$dest/$f"; done < <([ -f "$1/DELETE" ] && cat "$1/DELETE" || true)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$1/DATE")" GIT_COMMITTER_DATE="$(cat "$1/DATE")" git commit -q -F "$1/COMMIT"
}
for s in "$here"/stages/*/; do apply "$s"; done
for b in "$here"/branches/*/; do
  git checkout -q -b "feature/$(basename "$b")" main
  for c in "$b"*/; do apply "$c"; done
  git checkout -q main
done
git checkout -q "$checkout"
