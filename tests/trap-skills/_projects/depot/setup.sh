#!/usr/bin/env bash
# Разворачивает мини-проект Depot с историей в <dest>: стадии stages/* - коммиты main,
# branches/<имя>/* - коммиты ветки feature/<имя> от main.
# Использование: setup.sh <dest> [ветка для checkout: main, feature/<имя> или просто <имя>]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; checkout="${2:-main}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
cd "$dest"
git init -q -b main
git config user.name "Depot Team"; git config user.email "depot@example.com"
printf 'bin/\nobj/\n.nuget/\nTestResults/\n' > .gitignore
apply() { # $1 - каталог стадии или коммита ветки
  (cd "$1" && find . -type f ! -name COMMIT ! -name DATE ! -name DELETE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  while IFS= read -r f; do [ -n "$f" ] && rm -f "$dest/$f"; done < <([ -f "$1/DELETE" ] && cat "$1/DELETE" || true)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$1/DATE")" GIT_COMMITTER_DATE="$(cat "$1/DATE")" git commit -q -F "$1/COMMIT"
}
for s in "$here"/stages/*/; do apply "$s"; done
branch() { # $1 - каталог ветки
  local b="$1"
  git checkout -q -b "feature/$(basename "$b")" main
  for c in "$b"*/; do [ -d "$c" ] && apply "$c"; done
  git checkout -q main
}
for b in "$here"/branches/*/; do [ -d "$b" ] && branch "$b"; done
git show-ref -q --verify "refs/heads/$checkout" || checkout="feature/$checkout"
git checkout -q "$checkout"
