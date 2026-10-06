#!/usr/bin/env bash
# Разворачивает мини-проект Parcel с историей в <dest>: stages/* - коммиты main (теги - из файла TAGS
# стадии). Для checkout ветки feature/<имя> из branches/<имя>/: сначала каталоги main-* - коммиты в main
# (только для этой ветки), затем <n>-* - коммиты ветки feature/<имя> от main. Для main веток нет.
# Использование: setup.sh <dest> [ветка для checkout, по умолчанию main]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; checkout="${2:-main}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
if [ "$checkout" != main ]; then
  branch_dir="$here/branches/${checkout#feature/}"
  [ "${checkout#feature/}" != "$checkout" ] && [ -d "$branch_dir" ] || { echo "no branch: $checkout" >&2; exit 1; }
fi
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
cd "$dest"
git init -q -b main
git config user.name "Parcel Team"; git config user.email "team@parcel.example"
git config commit.gpgsign false; git config tag.gpgsign false; git config core.hooksPath /dev/null
printf 'node_modules/\n' > .gitignore
apply() { # $1 - каталог стадии или коммита ветки
  (cd "$1" && find . -type f ! -name COMMIT ! -name DATE ! -name DELETE ! -name TAGS -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  while IFS= read -r f; do rm -f "$dest/$f"; done < <([ -f "$1/DELETE" ] && cat "$1/DELETE" || true)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$1/DATE")" GIT_COMMITTER_DATE="$(cat "$1/DATE")" git commit -q -F "$1/COMMIT"
  if [ -f "$1/TAGS" ]; then while IFS= read -r t; do [ -n "$t" ] && git tag "$t"; done < "$1/TAGS"; fi
}
for s in "$here"/stages/*/; do apply "$s"; done
if [ "$checkout" != main ]; then
  for c in "$branch_dir"/main-*/; do [ -d "$c" ] && apply "$c"; done
  git checkout -q -b "$checkout" main
  for c in "$branch_dir"/[0-9]*-*/; do [ -d "$c" ] && apply "$c"; done
fi
git checkout -q "$checkout"
