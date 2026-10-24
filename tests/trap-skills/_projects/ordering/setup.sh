#!/usr/bin/env bash
# Разворачивает мини-проект Ordering в <dest>: stages/* - коммиты main по порядку, branches/<имя>/BASE - имя стадии,
# после которой ветка feature/<имя> отходит от main; коммиты ветки - подкаталоги NN-*/ (COMMIT, DATE, файлы, DELETE).
# Использование: setup.sh <dest> [ветка для checkout]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; checkout="${2:-main}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"; dest="$(cd "$dest" && pwd)"; cd "$dest"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
git init -q -b main
git config user.name "Ordering Team"; git config user.email "team@ordering.example"
apply() {
  (cd "$1" && find . -type f ! -name COMMIT ! -name DATE ! -name DELETE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  while IFS= read -r f; do rm -f "$dest/$f"; done < <([ -f "$1/DELETE" ] && cat "$1/DELETE" || true)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$1/DATE")" GIT_COMMITTER_DATE="$(cat "$1/DATE")" git commit -q -F "$1/COMMIT"
}
for s in "$here"/stages/*/; do
  apply "$s"
  for b in "$here"/branches/*/; do
    [ "$(cat "$b/BASE")" = "$(basename "$s")" ] || continue
    git checkout -q -b "feature/$(basename "$b")" main
    for c in "$b"*/; do apply "$c"; done
    git checkout -q main
  done
done
git checkout -q "$checkout"
