#!/usr/bin/env bash
# Раннер группы 4.2 (#303): промпты кейсов дословно, флаги исполнителя, выход в runs/<кейс>-<набор><N>/.
# run-group-4-2.sh <case> <set> <idx> [skill-file...]   skill-file - tests/trap-skills/<скилл>/inputs/SKILL-*.md   case: g-s, rv-q, n-q, n-q2, n-q3, g-t, n-t, g-d, n0
# Каталог прогонов - $G42_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G42_WORK:?G42_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G42_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([g-s]=rooms-feed-design [rv-q]=contract-v1-3 [n-q]=contract-v1-3-rooms [n-q2]=contract-v1-3-capacity [n-q3]=contract-v1-3-capacity2 [g-t]=contract-tests
 [n-t]=contract-tests-main [g-d]=mobile-handoff [n0]=duration-fix)
declare -A HOME_=([g-s]=removed/api-specification [rv-q]=api-spec-quality [n-q]=api-spec-quality [n-q2]=api-spec-quality [n-q3]=api-spec-quality [g-t]=api-testing
 [n-t]=api-testing [g-d]=api-documentation [n0]=api-documentation)
b=${BR[$case_]}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/bookings
bash "$T/_projects/bookings/setup.sh" "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""
if ((${#skills[@]})); then mkdir -p "$W/discipline"; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$(dirname "$(dirname "$s")")").md"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls "$W"/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
lim="Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}."
task=$(cd "$DIR" && git diff --name-only main HEAD -- docs/tasks | head -1)
case $case_ in
 g-s)
  P="Ты архитектор API в команде. Git-репозиторий сервиса Bookings лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - $task.
${sline}Выполни задачу в рабочем дереве. Не коммить.
$lim Сборки нет: из команд доступен только git. В ответе - список изменённых файлов и замечания к постановке, если есть."
  tools=('Bash(git *)'); out=DIFF.patch;;
 rv-q|n-q|n-q2|n-q3)
  desc=$(cd "$DIR" && git log -1 --format=%s)
  P="Ты ревьюер дизайна в команде. Git-репозиторий сервиса Bookings лежит в каталоге $DIR .
${sline}Оцени MR контракта: ветка feature/${b} против main. Описание MR: «${desc}»
Запиши в $DIR/REVIEW.md первой строкой вердикт - verdict: passed или verdict: failed; дальше находки, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Файлы репозитория не правь, кроме REVIEW.md.
$lim Сборки нет: из команд доступен только git. В ответе - только вердикт и число находок по severity."
  tools=('Bash(git *)'); out=REVIEW.md;;
 g-t|n-t)
  P="Ты .NET-разработчик тестов в команде. Git-репозиторий сервиса Bookings лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - $task.
${sline}Выполни задачу в рабочем дереве. Не коммить.
$lim Из команд доступны git, dotnet и docker ps/info/images; внешней сети нет, пакеты NuGet - только из локального кэша (версии - Directory.Packages.props). В ответе - список изменённых файлов и описание MR."
  tools=('Bash(git *)' 'Bash(dotnet *)' 'Bash(docker ps*)' 'Bash(docker info*)' 'Bash(docker images*)'); out=DIFF.patch;;
 g-d|n0)
  P="Ты .NET-разработчик в команде. Git-репозиторий сервиса Bookings лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - $task.
${sline}Выполни задачу в рабочем дереве. Не коммить.
$lim Из команд доступны git и dotnet; внешней сети нет, пакеты NuGet - только из локального кэша (версии - Directory.Packages.props). В ответе - только список изменённых файлов."
  tools=('Bash(git *)' 'Bash(dotnet *)'); out=DIFF.patch;;
 *) echo "unknown case $case_"; exit 1;;
esac
cd "$DIR"
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
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
bad=set(); ver=model=cost=sub=""; skills=mcp=None; tests=0
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
      if "dotnet test" in cmd: tests+=1
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
print(f"cli={ver} model={model} skills={skills} mcp={mcp} cost={cost} sub={sub} dotnet_test={tests} esc=[{';'.join(sorted(bad))}]")
PY
)
echo "$id $meta" | tee -a "$SP/log/summary.txt"
