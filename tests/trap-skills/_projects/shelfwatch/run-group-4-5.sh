#!/usr/bin/env bash
# Раннер группы 4.5 (#306): промпты кейсов дословно, флаги исполнителя, выход в runs/<кейс>-<набор><N>/.
# run-group-4-5.sh <case> <set> <idx> [skill-file...]   skill-file - tests/trap-skills/<скилл>/inputs/SKILL-*.md
# case: rv-pt, rv-ddp, rv-tf, rv-ml, rv-cv, rv-nlp, rv-opt, rv-hyg, n0 (ревью); k-hyg, k-nlp, k-ml, n0k (код)
# Каталог прогонов - $G45_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G45_WORK:?G45_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G45_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([rv-pt]=torch-train [rv-ddp]=torch-ddp [rv-tf]=keras-train [rv-ml]=churn-baseline [rv-cv]=shelf-vision [rv-nlp]=review-sentiment
 [rv-opt]=optuna-tune [rv-hyg]=tooling-pr [n0]=clean-diff [k-hyg]=quality-gates [k-nlp]=task-sentiment [k-ml]=task-churn [n0k]=task-metrics)
declare -A HOME_=([rv-pt]=python-pytorch [rv-ddp]=python-pytorch [rv-tf]=python-tensorflow [rv-ml]=removed/python-classical-ml [rv-cv]=python-computer-vision
 [rv-nlp]=python-nlp-transformers [rv-opt]=python-ml-optimization [rv-hyg]=python-project-hygiene [n0]=python-pytorch [k-hyg]=python-project-hygiene
 [k-nlp]=python-nlp-transformers [k-ml]=removed/python-classical-ml [n0k]=python-pytorch)
b=${BR[$case_]}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/shelfwatch
bash "$T/_projects/shelfwatch/setup.sh" "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""
if ((${#skills[@]})); then mkdir -p "$W/discipline"; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$(dirname "$(dirname "$s")")").md"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls "$W"/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
lim="Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}. Окружения Python с зависимостями нет, код не запускается: из команд доступен только git."
case $case_ in
 rv-*|n0)
  desc=$(cd "$DIR" && git log -1 --format=%B)
  P="Ты ML-инженер в команде. Git-репозиторий сервиса Shelfwatch лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка feature/$b против main. Описание MR:
«${desc}»
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
$lim В ответе - только число находок по severity."
  out=REVIEW.md;;
 k-*|n0k)
  task=$(cd "$DIR" && git diff --name-only main HEAD -- docs/tasks | head -1)
  P="Ты ML-инженер в команде. Git-репозиторий сервиса Shelfwatch лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - $task.
${sline}Выполни задачу в рабочем дереве. Не коммить.
$lim В ответе - список изменённых файлов и описание MR."
  out=DIFF.patch;;
 *) echo "unknown case $case_"; exit 1;;
esac
cd "$DIR"
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
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
