#!/usr/bin/env bash
# Разворачивает репозиторий мини-проекта: corpus - Loyalty с корпусом по конвенции каталога,
# alien - Wallet с чужой раскладкой требований, bait - Loyalty плюс stages/* из bait/ (кейс K7).
# stages/* - коммиты main. Использование: setup.sh <dest> [corpus|alien|bait]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$1"; variant="${2:-corpus}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"; dest="$(cd "$dest" && pwd)"
cd "$dest"
git init -q -b main
git config user.name "Product Team"; git config user.email "product@example.com"
stages=("$here/$variant"/stages/*/)
[ "$variant" = bait ] && stages=("$here/corpus"/stages/*/ "$here/bait"/stages/*/)
for s in "${stages[@]}"; do
  (cd "$s" && find . -type f ! -name COMMIT ! -name DATE -print0 | while IFS= read -r -d '' f; do
     mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done)
  git add -A
  GIT_AUTHOR_DATE="$(cat "$s/DATE")" GIT_COMMITTER_DATE="$(cat "$s/DATE")" git commit -q -F "$s/COMMIT"
done
