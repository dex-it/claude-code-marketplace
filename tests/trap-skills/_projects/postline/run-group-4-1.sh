#!/usr/bin/env bash
# Раннер группы 4.1 (#302): промпты дословно, флаги исполнителя, выход в runs/<кейс>-<набор><N>/ протокола-дома кейса.
# run-group-4-1.sh <case> <set> <idx> [edition-dir]
#   case: d1..d7, c1, t1..t3, w1..w5, p1, p2, r1, r0a, r2, r3, r0p, r0a2, r0p2, r0a3, r0p3
#   edition-dir: каталог с <скилл>.md; кейсу подаются только скиллы его роли (ROLE ниже), без каталога - контроль.
# Рабочий каталог прогонов - $G41_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G41_WORK:?G41_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G41_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; ed="${4:-}"
declare -A BR=([d1]=feed-design [d2]=donations-design [d3]=live-design [d4]=search-design [d5]=author-analytics-design
 [d6]=moderation-design [d7]=exports-design [c1]=season-capacity [t1]=mail-queue-choice [t2]=studio-components [t3]=similar-posts-choice [w1]=outbox-adr
 [w2]=retries-update [w3]=webhooks-adr [w4]=module-layout [w5]=errors-draft [p1]=plan-author [p2]=plan-author-2
 [r1]=webhooks-intake-adr [r0a]=thumbnails-adr [r2]=paid-subs-design [r3]=plan-defects [r0p]=plan-clean
 [r0a2]=thumbnails-adr-2 [r0p2]=plan-clean-2 [r0a3]=thumbnails-adr-3 [r0p3]=plan-clean-3)
declare -A TASK=([d1]=PL-11 [d2]=PL-12 [d3]=PL-13 [d4]=PL-14 [d5]=PL-15 [d6]=PL-16 [d7]=PL-28 [c1]=PL-17 [t1]=PL-18 [t2]=PL-19 [t3]=PL-29
 [w1]=PL-20 [w2]=PL-21 [w3]=PL-22 [w4]=PL-23 [w5]=PL-25 [p1]=PL-31 [p2]=PL-36 [r1]=PL-26 [r0a]=PL-27 [r2]=PL-30-review
 [r3]=PL-31-review [r0p]=PL-31-review [r0a2]=PL-33 [r0p2]=PL-32-review [r0a3]=PL-35 [r0p3]=PL-34-review)
declare -A DOC=([r1]=docs/adr/ADR-0006-incoming-webhooks.md [r0a]=docs/adr/ADR-0007-media-previews.md
 [r2]=docs/design/PL-30.md [r3]=docs/plans/PL-31.md [r0p]=docs/plans/PL-31.md
 [r0a2]=docs/adr/ADR-0008-image-previews.md [r0p2]=docs/plans/PL-32.md
 [r0a3]=docs/adr/ADR-0009-image-previews.md [r0p3]=docs/plans/PL-34.md)
declare -A HOME_=([d1]=removed/reference-architectures [d3]=removed/reference-architectures [d4]=removed/reference-architectures
 [d2]=removed/cap-consistency [d5]=scalability [d6]=scalability [d7]=scalability [c1]=removed/capacity-planning [t1]=removed/tech-evaluation [t2]=removed/tech-evaluation [t3]=removed/tech-evaluation
 [w1]=adr-quality [w2]=adr-quality [w3]=adr-quality [w4]=adr-quality [w5]=adr-quality [r1]=adr-quality [r0a]=adr-quality
 [r2]=design-quality [p1]=plan-quality [p2]=plan-quality [r3]=plan-quality [r0p]=plan-quality [r0a2]=adr-quality [r0p2]=plan-quality [r0a3]=adr-quality [r0p3]=plan-quality)
ARCH="cap-consistency scalability capacity-planning reference-architectures tech-evaluation design-quality"
case $case_ in d*|c*|t*) ROLE="$ARCH";; w*) ROLE="adr-quality";; p*) ROLE="plan-quality implementation-plan";;
 r*) ROLE="design-quality plan-quality adr-quality cap-consistency";; esac
b=${BR[$case_]}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/postline
bash $T/_projects/postline/setup.sh "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""; used=""
if [[ -n $ed ]]; then mkdir -p $W/discipline
  for s in $ROLE; do [[ -f $ed/$s.md ]] && { cp "$ed/$s.md" "$W/discipline/$s.md"; used="$used $s"; }; done
  if [[ -n $used ]]; then add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls $W/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi; fi
dline="не читай и не пиши вне каталога репозитория${used:+, кроме файлов дисциплины выше}"
if [[ $case_ == r* ]]; then
  P="Ты ревьюер дизайна в команде продукта Postline. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/${TASK[$case_]}.md.
${sline}Оцени документ ${DOC[$case_]}: можно ли его принимать. Запиши находки в $DIR/REVIEW.md, по строке на находку: место в документе - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Документ не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; $dline. Из команд доступен только git. В ответе - только число находок по severity."
  out=REVIEW.md
else
  P="Ты архитектор в команде продукта Postline. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/${TASK[$case_]}.md.
${sline}Выполни задачу в рабочем дереве репозитория. Код не пиши. Не коммить.
Ограничения: не вызывай Skill tool; $dline. Из команд доступен только git. В ответе - только список изменённых и созданных файлов."
  out=DIFF.patch
fi
cd "$DIR"
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$T/${HOME_[$case_]}/runs/$id; rm -rf "$R"; mkdir -p "$R"
if [[ $out == DIFF.patch ]]; then git add -A -N . || exit 1; git diff > "$R/DIFF.patch"
else cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md"; fi
python3 - "$SP/log/$id.jsonl" "$DIR" "$W/discipline" "$REPO" "$R" "$used" <<'PY'
import json,sys,re,os
log,d,disc,repo,R,used=sys.argv[1:]
init=res=None; bad=set()
for l in open(log):
  try: m=json.loads(l)
  except Exception: continue
  if m.get("type")=="system" and m.get("subtype")=="init": init=m
  if m.get("type")=="result": res=m
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if p.startswith("/") and not (p.startswith(d) or p.startswith(disc)): bad.add(p)
      cmd=i.get("command","")
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
meta={"model":(init or {}).get("model"),"claude_code_version":(init or {}).get("claude_code_version"),
 "skills_in_session":(init or {}).get("skills"),"mcp_servers":(init or {}).get("mcp_servers"),
 "discipline":used.split(),"total_cost_usd":(res or {}).get("total_cost_usd"),"subtype":(res or {}).get("subtype"),
 "num_turns":(res or {}).get("num_turns"),"escapes":sorted(bad)}
json.dump(meta,open(os.path.join(R,"meta.json"),"w"),ensure_ascii=False,indent=1)
for f in os.listdir(R):
  p=os.path.join(R,f); t=open(p,encoding="utf-8",errors="replace").read()
  t=t.replace(d,"<run>").replace(disc,"<discipline>").replace(repo,"<repo>")
  open(p,"w",encoding="utf-8").write(t)
print(f'{os.path.basename(R)} cost={meta["total_cost_usd"]} {meta["subtype"]} cli={meta["claude_code_version"]} esc={meta["escapes"]}')
PY
