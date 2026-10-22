#!/usr/bin/env bash
# Разворачивает репозиторий кейса задачи #215: main (stages/* Postline) + ветка feature/derived-<артефакт>-<правка>
# с историей: требования R1 -> запись судьи -> выведенный артефакт -> правка требований -> повторная запись судьи -> задача.
# Использование: setup-derived.sh <dest> <plan|adr> <none|loud|quiet> <pin 0|1> [rejudge 1|0]
#   pin=1 кладёт в шапку артефакта derived-from с пинами ID@R1 (указатель - коммит судимого R1);
#   rejudge=0 пропускает повторную запись судьи после правки (правка мимо суда).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; pl="$here/.."
dest="$1"; art="$2"; kind="$3"; pin="$4"; rejudge="${5:-1}"
[ -e "$dest" ] && { echo "exists: $dest" >&2; exit 1; }
mkdir -p "$dest"; dest="$(cd "$dest" && pwd)"; cd "$dest"
git init -q -b main
git config user.name "Postline Team"; git config user.email "team@postline.example"
copy() { (cd "$1" && find . -type f -print0 | while IFS= read -r -d '' f; do mkdir -p "$dest/$(dirname "$f")"; cp "$f" "$dest/$f"; done); }
commit() { git add -A; GIT_AUTHOR_DATE="$2" GIT_COMMITTER_DATE="$2" git commit -q -m "$1"; }
for s in "$pl"/stages/*/; do
  copy "$s"; rm -f COMMIT DATE
  git add -A; GIT_AUTHOR_DATE="$(cat "$s/DATE")" GIT_COMMITTER_DATE="$(cat "$s/DATE")" git commit -q -F "$s/COMMIT"
done
git checkout -q -b "feature/derived-$art-$kind"
if [ "$art" = plan ]; then
  doc=PL-34; d1=2026-09-24; d3=2026-10-06; d4=2026-10-09; dt=2026-10-12; srsdir=docs/requirements/PL-34
  m1="SRS PL-34: требования и журнал решений"; m3="PL-34: дизайн и план реализации"; mt="PL-34: проверка плана"
  art_file=docs/plans/PL-34.md; anchor='^Составлен'; ids="FR-1 FR-2 FR-3 FR-4 NFR-1"
else
  doc=PL-09; d1=2026-09-29; d3=2026-10-05; d4=2026-10-08; dt=2026-10-12; srsdir=docs/requirements/PL-09
  m1="SRS PL-09: требования и журнал решений"; m3="ADR-0009: превью изображений"; mt="PL-35: ревью ADR-0009"
  art_file=docs/adr/ADR-0009-image-previews.md; anchor='^Статус:'; ids="FR-1 FR-2 FR-3 NFR-1"
fi
src="$here/$art"
copy "$src/1-requirements"; commit "$m1" "${d1}T11:00:00+03:00"; S1=$(git rev-parse --short HEAD)
sed "s/@@SRC1@@/$S1/g" "$src/judge-1.md" > "$dest/$srsdir/srs.checks.md"
commit "SRS $doc: запись судьи, первый суд" "${d1}T15:00:00+03:00"
copy "$src/3-$([ $art = plan ] && echo design-plan || echo adr)"
if [ "$pin" = 1 ]; then
  blk="derived-from:"; for i in $ids; do blk="$blk\n  - $i@R1 ($S1)"; done
  awk -v blk="$blk" -v anchor="$anchor" '{print} $0 ~ anchor && !done {printf "\n%s\n", blk; done=1}' "$art_file" | sed 's/\\n/\n/g' > "$art_file.tmp" && mv "$art_file.tmp" "$art_file"
fi
commit "$m3" "${d3}T12:00:00+03:00"
copy "$src/edit-$kind"; commit "SRS $doc: правка принятого документа" "${d4}T10:00:00+03:00"; S2=$(git rev-parse --short HEAD)
if [ "$rejudge" = 1 ]; then
  { sed "s/@@SRC1@@/$S1/g" "$src/judge-1.md"; sed -e "s/@@SRC1@@/$S1/g" -e "s/@@SRC2@@/$S2/g" "$src/judge-2-$kind.md"; } > "$dest/$srsdir/srs.checks.md"
  commit "SRS $doc: запись судьи после правки" "${d4}T14:00:00+03:00"
fi
mkdir -p docs/tasks
if [ "$art" = plan ]; then
  printf '# PL-34: проверка плана\n\nПлан `docs/plans/PL-34.md` передан в работу команде payments.\n' > docs/tasks/PL-34-review.md
else
  printf '# PL-35: Ревью ADR-0009\n\nADR-0009 о превью изображений подан на ревью перед реализацией.\n' > docs/tasks/PL-35.md
fi
commit "$mt" "${dt}T09:00:00+03:00"
