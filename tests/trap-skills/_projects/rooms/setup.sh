#!/usr/bin/env bash
# Разворачивает репозиторий мини-проекта Rooms: этапы stages/* варианта - коммиты main по порядку.
# Использование: setup.sh <dest> <brief|brd|uc|srs|badunit|badset|baduc|badst|ready|ticket|baddesign|badinvest>
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; variant="$2"
declare -A V=(
 [brief]="1-base 2-brief" [brd]="1-base 2-brief 3-brd" [uc]="1-base 2-brief 3-brd 4-uc"
 [srs]="1-base 2-brief 3-brd 4-uc 5-srs"
 [badunit]="1-base 2-brief 3-brd 4-uc x-badunit" [badset]="1-base 2-brief 3-brd 4-uc x-badset"
 [baduc]="1-base 2-brief 3-brd 4-uc 5-srs x-baduc" [badst]="1-base 2-brief 3-brd 4-uc 5-srs x-badst"
 [ready]="1-base 2-brief 3-brd 4-uc 5-srs x-ready" [ticket]="1-base 2-brief 3-brd 4-uc 5-srs x-ticket"
 [baddesign]="1-base 2-brief 3-brd 4-uc 5-srs x-baddesign" [badinvest]="1-base 2-brief 3-brd 4-uc 5-srs x-badinvest")
stages="${V[$variant]:?неизвестный вариант $variant}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"; dest="$(cd "$dest" && pwd)"
cd "$dest"
git init -q -b main
git config user.name "Product Team"; git config user.email "product@example.com"
for n in $stages; do
  s="$here/stages/$n"
  (cd "$s" && find . -type f ! -name COMMIT ! -name DATE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$s/DATE")" GIT_COMMITTER_DATE="$(cat "$s/DATE")" git commit -q -F "$s/COMMIT"
done
