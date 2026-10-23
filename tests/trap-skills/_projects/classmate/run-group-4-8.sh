#!/usr/bin/env bash
# run-group-4-8.sh <case> <set> <idx> [edition-dir] - вызов, кейсы и база плеч в README мини-проекта.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G48_WORK:?G48_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G48_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; ed="${4:-}"
MINER=$REPO/plugins/specialists/review/dex-rulebook-miner
declare -A BR=([wds]=packages-spec [rds]=reviews-docs [wpd]=packages-discovery [rpd]=groups-discovery
 [wep]=packages-epic [wpr]=q4-priorities [rbl]=q1-plan-review [r0p]=q2-plan-clean [wbp]=booking-process
 [rbp]=cancellation-process-review [r0b]=reschedule-process-review [k1]=package-refund [k2]=last-slot-bug
 [k0]=refund-24h-bug [rm1]=rules-mining [rq1]=rulebook-review [rq2]=rulebook-review-2 [rq0]=rulebook-review-clean)
declare -A TASK=([wds]=CM-30 [rds]=CM-31 [wpd]=CM-10 [rpd]=CM-11 [wep]=CM-24 [wpr]=CM-25 [rbl]=CM-26 [r0p]=CM-27
 [wbp]=CM-40 [rbp]=CM-41 [r0b]=CM-42 [k1]=CM-50 [k2]=CM-51 [k0]=CM-52 [rm1]=CM-60 [rq1]=CM-61 [rq2]=CM-62 [rq0]=CM-63)
declare -A HOME_=([wds]=doc-standards [rds]=doc-standards [wpd]=product-discovery [rpd]=product-discovery
 [wep]=epic-planning [wpr]=prioritization [rbl]=epic-planning [r0p]=epic-planning [wbp]=removed/bpmn [rbp]=removed/bpmn [r0b]=removed/bpmn
 [k1]=removed/karpathy-guidelines [k2]=removed/karpathy-guidelines [k0]=removed/karpathy-guidelines [rm1]=rule-mining
 [rq1]=rulebook-quality [rq2]=rulebook-quality [rq0]=rulebook-quality)
[[ -n ${BR[$case_]:-} ]] || { echo "unknown case $case_"; exit 1; }
BACKLOG="agile epic-planning prioritization"
case $case_ in
 wds) ROLE=doc-standards; WHO="технический писатель";;
 rds) ROLE=doc-standards; WHO="ревьюер";;
 wpd) ROLE=product-discovery; WHO="продакт-менеджер";;
 rpd) ROLE=product-discovery; WHO="ревьюер";;
 wep|wpr) ROLE="$BACKLOG"; WHO="владелец бэклога";;
 rbl) ROLE="$BACKLOG"; WHO="ревьюер";;
 r0p) ROLE="$BACKLOG product-discovery"; WHO="ревьюер";;
 wbp) ROLE=bpmn; WHO="аналитик процессов";;
 rbp|r0b) ROLE=bpmn; WHO="ревьюер";;
 k1|k2|k0) ROLE=karpathy-guidelines; WHO="разработчик";;
 rm1) ROLE=rule-mining; WHO="";;
 rq1|rq2|rq0) ROLE=rulebook-quality; WHO="";;
esac
b=${BR[$case_]}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log" "$W/discipline"
DIR=$W/classmate
bash $T/_projects/classmate/setup.sh "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""; used=""; files=""
# База RQ* - потребитель скилла: норматив свода подаётся в обоих плечах, иначе плечи различались бы не одним скиллом.
if [[ $case_ == rq* ]]; then cp -r "$MINER/skills/project-rulebook" "$W/discipline/project-rulebook"; files="$W/discipline/project-rulebook/SKILL.md"; fi
if [[ -n $ed ]]; then
  for s in $ROLE; do [[ -f $ed/$s.md ]] && { cp "$ed/$s.md" "$W/discipline/$s.md"; used="$used $s"; files="${files:+$files }$W/discipline/$s.md"; }; done
fi
if [[ -n $files ]]; then add=(--add-dir "$W/discipline")
  if [[ $case_ == rm1 ]]; then
    sline="Skill tool недоступен; ловушки добычи (то, что тело называет \`dex-rulebook-miner:rule-mining\`) - файл $files, прочитай его перед работой.
"
  else
    sline="Перед работой прочитай $files - дисциплина, принятая в команде.
"
  fi
fi
dline="не читай и не пиши вне каталога репозитория${files:+, кроме файлов дисциплины выше}"
sys=(); tools=(Read Write Edit Glob Grep Bash); allow=('Bash(git *)')
case $case_ in
 rds|rpd|rbl|r0p|rbp|r0b)
  P="Ты ${WHO} в команде продукта Classmate. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/${TASK[$case_]}.md.
${sline}Выполни ревью, которое поручает задача. Запиши находки в $DIR/REVIEW.md, по строке на находку: место в документе - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Документы не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; $dline. Из команд доступен только git. В ответе - только число находок по severity."
  out=REVIEW.md;;
 k1|k2|k0)
  P="Ты ${WHO} в команде продукта Classmate. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/${TASK[$case_]}.md.
${sline}Выполни задачу в рабочем дереве репозитория. Не коммить.
Ограничения: не вызывай Skill tool; $dline. Из команд доступны git, node и npm test. В ответе - что сделано и что осталось решить, без перечня команд."
  allow+=('Bash(node *)' 'Bash(npm test*)'); out=REPLY;;
 rm1)
  # База RM1 - тело rule-collector без frontmatter: его нормы добычи есть у потребителя и без скилла.
  sys=(--append-system-prompt "$(awk 'f>=2{print} /^---$/{f++}' "$MINER/agents/rule-collector.md")")
  tools=(Read Glob Grep Bash)
  P="Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; поручение - docs/tasks/${TASK[$case_]}.md.
${sline}Выполни поручение. Контракт стыка (\`node-contract\`) не подан: поля входа - в поручении, выход - handoff текстом ответа.
Ограничения: не вызывай Skill tool; ничего не пиши на диск; $dline. Из команд доступен только git. В ответе - только handoff."
  out=HANDOFF;;
 rq1|rq2|rq0)
  P="Ты ведёшь шаг вердикта команды /rulebook: оракул судит документ свода, не правила по существу; failed - возврат на добычу с находками, не публикация с оговоркой. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/${TASK[$case_]}.md.
${sline}Вынеси вердикт по своду. Запиши в $DIR/REVIEW.md первой строкой вердикт (passed или failed), дальше по строке на находку: место в своде - что не так и чем кончится - блокирующая или неблокирующая. Без вступлений и резюме. Свод не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; $dline. Из команд доступен только git. В ответе - только вердикт и число находок."
  out=REVIEW.md;;
 *)
  P="Ты ${WHO} в команде продукта Classmate. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/${TASK[$case_]}.md.
${sline}Выполни задачу в рабочем дереве репозитория. Код не пиши. Не коммить.
Ограничения: не вызывай Skill tool; $dline. Из команд доступен только git. В ответе - только список изменённых и созданных файлов."
  out=DIFF.patch;;
esac
cd "$DIR"
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools "${tools[@]}" --allowedTools "${allow[@]}" "${add[@]}" "${sys[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$T/${HOME_[$case_]}/runs/$id; rm -rf "$R"; mkdir -p "$R"
case $out in
 DIFF.patch|REPLY) git add -A -N . || exit 1; git diff > "$R/DIFF.patch";;
 REVIEW.md) cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md";;
esac
python3 - "$SP/log/$id.jsonl" "$DIR" "$W/discipline" "$REPO" "$R" "$used" "$out" <<'PY'
import json,sys,os
log,d,disc,repo,R,used,out=sys.argv[1:]
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
text=(res or {}).get("result") or "(нет ответа)"
if out in ("REPLY","HANDOFF"): open(os.path.join(R,out+".md"),"w",encoding="utf-8").write(text)
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
