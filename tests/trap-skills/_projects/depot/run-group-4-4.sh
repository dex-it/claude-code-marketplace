#!/usr/bin/env bash
# Раннер группы 4.4 (#305): промпты кейсов дословно, флаги исполнителя, выход в runs/<кейс>-<набор><N>/ протокола скилла-дома.
# run-group-4-4.sh <case> <set> <idx> [skill-file...]   skill-file - tests/trap-skills/<скилл>/inputs/SKILL-*.md
# Выход прогона: DIFF.patch (git diff HEAD, виден и удалённый отслеженный файл), ANSWER.md, meta.json (время, коммит репозитория).
# case: dk-w, dk-a, ga-c, k-w, k-f, k-t, ga-w, gl-w, j-w, tc-w, cg, n-ci. Каталог прогонов - $G44_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G44_WORK:?G44_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G44_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([dk-w]=dockerize [dk-a]=dockerize-pkg [ga-c]=ci-github-cache [k-w]=k8s-deploy [k-f]=k8s-fix [k-t]=k8s-incident [ga-w]=ci-github [gl-w]=ci-gitlab [j-w]=ci-jenkins [tc-w]=ci-teamcity [cg]=ci-gates-fix [n-ci]=version-endpoint)
declare -A HOME_=([dk-w]=docker [dk-a]=docker [ga-c]=github-actions [k-w]=kubernetes [k-f]=kubernetes [k-t]=kubernetes [ga-w]=github-actions [gl-w]=gitlab-ci [j-w]=jenkins [tc-w]=teamcity [cg]=ci-gates [n-ci]=ci-gates)
declare -A ROLE=([dk-w]="DevOps-инженер" [dk-a]="DevOps-инженер" [ga-c]="DevOps-инженер" [k-w]="DevOps-инженер" [k-f]="DevOps-инженер" [k-t]="DevOps-инженер" [ga-w]="DevOps-инженер" [gl-w]="DevOps-инженер" [j-w]="DevOps-инженер" [tc-w]="DevOps-инженер" [cg]="DevOps-инженер" [n-ci]=".NET-разработчик")
b=${BR[$case_]:?unknown case $case_}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/depot
bash "$T/_projects/depot/setup.sh" "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""
if ((${#skills[@]})); then mkdir -p "$W/discipline"; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$(dirname "$(dirname "$s")")").md"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls "$W"/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
lim="Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}."
task=$(cd "$DIR" && git diff --name-only main HEAD -- docs/tasks | head -1)
P="Ты ${ROLE[$case_]} в команде. Git-репозиторий сервиса Depot лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - $task.
${sline}Выполни задачу в рабочем дереве. Не коммить.
$lim Сборки, кластера и сети нет: из команд доступен только git. В ответе - список изменённых файлов и замечания к задаче, если есть."
cd "$DIR"
t0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
head0=$(git -C "$REPO" rev-parse HEAD); dirty0=$(git -C "$REPO" status --porcelain -- "$T/_projects" | wc -l | tr -d ' ')
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 2 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
t1=$(date -u +%Y-%m-%dT%H:%M:%SZ)
R=$T/${HOME_[$case_]}/runs/$id; rm -rf "$R"; mkdir -p "$R"
clean() { sed -e "s#$DIR#<run>#g" -e "s#$W#<work>#g" -e "s#$SP#<work>#g" -e "s#$REPO#<repo>#g" -e "s#$HOME#~#g"; }
git add -A -N . && git diff HEAD -- . | clean > "$R/DIFF.patch"
python3 - "$SP/log/$id.jsonl" > "$R/ANSWER.md.raw" <<'PY'
import json,sys
r=""
for l in open(sys.argv[1]):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="result": r=m.get("result") or ""
print(r)
PY
clean < "$R/ANSWER.md.raw" > "$R/ANSWER.md"; rm -f "$R/ANSWER.md.raw"
meta=$(python3 - "$SP/log/$id.jsonl" "$DIR" "$W/discipline" "$REPO" <<'PY'
import json,sys
log,d,disc,repo=sys.argv[1:]
bad=set(); ver=model=cost=sub=""; skills=mcp=None
for l in open(log):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="system" and m.get("subtype")=="init":
    ver=m.get("claude_code_version",""); model=m.get("model",""); skills=m.get("skills"); mcp=m.get("mcp_servers")
  if m.get("type")=="result": cost=m.get("total_cost_usd"); sub=m.get("subtype")
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if p.startswith("/") and not (p.startswith(d) or p.startswith(disc)): bad.add(p)
      cmd=i.get("command","")
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
print(f"cli={ver} model={model} skills={skills} mcp={mcp} cost={cost} sub={sub} esc=[{';'.join(sorted(bad))}]")
PY
)
echo "$id $meta" | tee -a "$SP/log/summary.txt"
# meta.json: время старта и конца прогона, коммит репозитория на момент запуска (порядок «ключ, потом прогоны» виден по метке и коммиту) и поданная дисциплина
python3 - "$R/meta.json" "$id" "$t0" "$t1" "$head0" "$dirty0" "$meta" "$W/discipline" <<'PY'
import json,os,sys
out,i,t0,t1,head,dirty,meta,disc=sys.argv[1:9]
kv=dict(x.split("=",1) for x in meta.split(" ") if "=" in x)
json.dump({"id":i,"started_utc":t0,"finished_utc":t1,"repo_head":head,"project_files_dirty":int(dirty),"discipline":sorted(os.listdir(disc)) if os.path.isdir(disc) else [],"cli":kv.get("cli"),"model":kv.get("model"),"cost_usd":kv.get("cost"),"result":kv.get("sub")},open(out,"w"),ensure_ascii=False,indent=1)
PY
