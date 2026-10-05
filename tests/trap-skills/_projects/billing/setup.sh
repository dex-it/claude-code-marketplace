#!/usr/bin/env bash
# Разворачивает мини-проект Billing с историей в <dest>: стадии stages/* - коммиты main,
# branches/* - ветки MR от main. Пакет Acme.Ledger.Client собирается из vendor/ и кладётся в
# packages-local/ первым коммитом; исходник пакета в <dest> не попадает.
# Использование: setup.sh <dest> [ветка для checkout]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; checkout="${2:-main}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
pack="$(mktemp -d)"
cp -r "$here/vendor/Acme.Ledger.Client" "$pack/src"
dotnet pack "$pack/src" -c Release -o "$pack/out" -p:RepositoryUrl= >/dev/null
cd "$dest"
git init -q -b main
git config user.name "Billing Team"; git config user.email "billing@example.com"
printf 'bin/\nobj/\n.nuget/\n' > .gitignore
mkdir -p packages-local && cp "$pack/out/"*.nupkg packages-local/
rm -rf "$pack"
apply() { # $1 - каталог стадии
  (cd "$1" && find . -type f ! -name COMMIT ! -name DATE ! -name DELETE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  while IFS= read -r f; do rm -f "$dest/$f"; done < <([ -f "$1/DELETE" ] && cat "$1/DELETE" || true)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$1/DATE")" GIT_COMMITTER_DATE="$(cat "$1/DATE")" git commit -q -F "$1/COMMIT"
}
for s in "$here"/stages/*/; do apply "$s"; done
for b in "$here"/branches/*/; do
  [ -d "$b" ] || continue
  name="$(basename "$b")"
  git checkout -q -b "feature/$name" main
  for c in "$b"*/; do apply "$c"; done
  git checkout -q main
done
git checkout -q "$checkout"
