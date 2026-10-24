#!/usr/bin/env bash
# Раннер группы 4.3 (#304): промпты кейсов дословно, флаги исполнителя, выход в runs/<кейс>-<набор><N>/.
# run-group-4-3.sh <case> <set> <idx> [skill-file...]   skill-file - tests/trap-skills/<скилл>/inputs/SKILL-*.md
# case: код - g-k g-b g-c g-m g-e n-g; ревью - rv-k rv-b rv-c rv-m rv-e n-rv
# Каталог прогонов - $G43_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G43_WORK:?G43_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G43_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([g-k]=order-stream [g-b]=payment-flow [g-c]=price-cache [g-m]=order-history [g-e]=product-search [n-g]=volume-discount
 [rv-k]=kafka-pipeline [rv-b]=payment-saga [rv-c]=catalog-cache [rv-m]=order-archive [rv-e]=catalog-search [n-rv]=catalog-sync)
declare -A HOME_=([g-k]=kafka [rv-k]=kafka [g-b]=rabbitmq [rv-b]=rabbitmq [g-c]=redis [rv-c]=redis [g-m]=mongodb [rv-m]=mongodb
 [g-e]=elasticsearch [rv-e]=elasticsearch [n-g]=kafka [n-rv]=kafka)
b=${BR[$case_]:-}; [[ -n $b ]] || { echo "unknown case $case_"; exit 1; }; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/fulfil
bash "$T/_projects/fulfil/setup.sh" "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""
if ((${#skills[@]})); then mkdir -p "$W/discipline"; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$(dirname "$(dirname "$s")")").md"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls "$W"/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
lim="Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}."
task=$(cd "$DIR" && git diff --name-only main HEAD -- docs/tasks | head -1)
if [[ $case_ == g-* || $case_ == n-g ]]; then
  P="Ты .NET-разработчик в команде. Git-репозиторий сервиса Fulfil лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - $task.
${sline}Выполни задачу в рабочем дереве. Не коммить.
$lim Сборки нет: из команд доступен только git. В ответе - список изменённых файлов и 2-3 строки о принятых решениях."
  out=DIFF.patch
else
  desc=$(cd "$DIR" && git log -1 --format=%s)
  P="Ты .NET-ревьюер в команде. Git-репозиторий сервиса Fulfil лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка feature/${b} против main. Описание MR: «${desc}» (подробности - $task).
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Файлы репозитория не правь, кроме REVIEW.md.
$lim Сборки нет: из команд доступен только git. В ответе - только число находок по severity."
  out=REVIEW.md
fi
tools=('Bash(git *)')
cd "$DIR"
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 2.5 \
  --tools Read Write Edit Glob Grep Bash --allowedTools "${tools[@]}" "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
R=$T/${HOME_[$case_]}/runs/$id; rm -rf "$R"; mkdir -p "$R"
clean() { sed -e "s#$DIR#<run>#g" -e "s#$W#<work>#g" -e "s#$SP#<work>#g" -e "s#$REPO#<repo>#g" -e "s#$HOME#~#g"; }
if [[ $out == DIFF.patch ]]; then git add -A -N . && git diff -- . ':(exclude)REVIEW.md' | clean > "$R/DIFF.patch"; fi
[[ -f REVIEW.md ]] && clean < REVIEW.md > "$R/REVIEW.md"
[[ $out == REVIEW.md && ! -f REVIEW.md ]] && echo "(нет REVIEW.md)" > "$R/REVIEW.md"
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
bad=set(); ver=model=cost=sub=""; skills=mcp=None; calls=0
for l in open(log):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="system" and m.get("subtype")=="init":
    ver=m.get("claude_code_version",""); model=m.get("model",""); skills=m.get("skills"); mcp=m.get("mcp_servers")
  if m.get("type")=="result": cost=m.get("total_cost_usd"); sub=m.get("subtype")
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      calls+=1
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if p.startswith("/") and not (p.startswith(d) or p.startswith(disc)): bad.add(p)
      cmd=i.get("command","")
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
print(f"cli={ver} model={model} skills={skills} mcp={mcp} cost={cost} sub={sub} calls={calls} esc=[{';'.join(sorted(bad))}]")
PY
)
echo "$id $meta" | tee -a "$SP/log/summary.txt"
