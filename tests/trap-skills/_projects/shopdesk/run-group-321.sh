#!/usr/bin/env bash
# Раннер захода #321 (V3, V9, V10 ts-vitest-jest): промпты кейсов дословно, флаги исполнителя, выход в
# ts-vitest-jest/runs/<кейс>-<набор><N>/. Образец - run-group-4-2.sh и раннер группы 2.3 (K3: Bash в песочнице
# Claude Code без внешней сети, чтобы исполнитель мог гонять tsc и vitest).
# run-group-321.sh <case> <set> <idx> [skill-file...]   case: d1 (SD-18, ветка checkout-tests), d0 (SD-19, money-tests)
#   skill-file - редакция SKILL.md (tests/trap-skills/ts-vitest-jest/inputs/SKILL-*.md); без него - контроль.
# Каталог прогонов - $G321_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G321_WORK:?G321_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G321_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
P="$T/_projects/shopdesk"
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([d1]=checkout-tests [d0]=money-tests)
declare -A TASK=([d1]=docs/tasks/SD-18-checkout-tests.md [d0]=docs/tasks/SD-19-price-format-tests.md)
declare -A MINES=([d1]=K3D [d0]=K3N)
b=${BR[$case_]:?unknown case $case_}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$W" "$SP/log" "$SP/tpl"
[[ -d $SP/tpl/$b ]] || bash "$P/setup.sh" "$SP/tpl/$b" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $b"; exit 1; }
DIR=$W/shopdesk
cp -cR "$SP/tpl/$b" "$DIR" || cp -R "$SP/tpl/$b" "$DIR"
[[ -f $SP/sandbox.json ]] || echo '{"sandbox":{"enabled":true,"autoAllowBashIfSandboxed":true,"allowUnsandboxedCommands":false,"network":{"allowLocalBinding":true,"allowedDomains":[]}}}' > "$SP/sandbox.json"
add=(); sline=""
if ((${#skills[@]})); then
  s="${skills[0]}"; mkdir -p "$W/rules/ts-vitest-jest"; cp "$s" "$W/rules/ts-vitest-jest/SKILL.md"
  add=(--add-dir "$W/rules"); sline="Перед работой прочитай $W/rules/ts-vitest-jest/SKILL.md - практики, принятые в команде.
"
fi
outside="${skills:+, кроме файлов практик выше}"
PROMPT="Ты разработчик unit-тестов (TypeScript) в команде. Git-репозиторий проекта Shopdesk (монорепозиторий: api на Express, web на React, e2e) лежит в каталоге $DIR , текущая ветка - feature/$b.
${sline}Задача - ${TASK[$case_]}. Выполни её в рабочем дереве; коммитить не нужно.
Зависимости установлены (node_modules), внешней сети нет; доступны git, npm run typecheck, npm test, npx tsc, npx vitest.
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${outside}. В ответе - список изменённых файлов и 2-3 строки о решениях."
cd "$DIR"
claude -p "$PROMPT" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1 --max-turns 150 \
  --settings "$SP/sandbox.json" --tools Read,Write,Edit,Glob,Grep,Bash --allowed-tools Read,Write,Edit,Glob,Grep,Bash "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
R=$T/ts-vitest-jest/runs/$id; rm -rf "$R"; mkdir -p "$R"
clean() { sed -e "s#$DIR#<run>#g" -e "s#$W#<work>#g" -e "s#$SP#<work>#g" -e "s#$REPO#<repo>#g" -e "s#$HOME#~#g"; }
printf '%s\n' "$PROMPT" | clean > "$R/prompt.txt"
git add -A -N . 2>/dev/null
git diff HEAD -- . ':(exclude)package-lock.json' | clean > "$R/diff.patch"
python3 - "$SP/log/$id.jsonl" > "$R/answer.md.raw" <<'PY'
import json,sys
r=""
for l in open(sys.argv[1]):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="result": r=m.get("result") or ""
print(r)
PY
clean < "$R/answer.md.raw" > "$R/answer.md"; rm -f "$R/answer.md.raw"
{
  echo "case=$case_"
  (cd "$DIR" && npm run typecheck >/dev/null 2>&1; echo "typecheck=$?")
  (cd "$DIR" && npm test >/dev/null 2>&1; echo "test=$?")
  bash "$P/mines/${MINES[$case_]}/run.sh" "$DIR"
} 2>&1 | clean > "$R/grade.txt"
python3 - "$SP/log/$id.jsonl" "$DIR" "$W/rules" "$REPO" > "$R/meta.json" <<'PY'
import json,sys
log,d,rules,repo=sys.argv[1:]
bad=set(); m_={"id":None}; skill=0; bash=[]
out={}
for l in open(log):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="system" and m.get("subtype")=="init":
    out.update(cli=m.get("claude_code_version"), model=m.get("model"), skills=m.get("skills"), mcp=m.get("mcp_servers"))
  if m.get("type")=="result":
    out.update(cost=m.get("total_cost_usd"), subtype=m.get("subtype"), turns=m.get("num_turns"), is_error=m.get("is_error"))
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      if c.get("name")=="Skill": skill+=1
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if p.startswith("/") and not (p.startswith(d) or p.startswith(rules)): bad.add(p)
      if c.get("name")=="Bash": bash.append(i.get("command","")[:160])
out.update(skill_tool_calls=skill, bash_calls=len(bash), reads_outside=sorted(bad))
print(json.dumps(out, ensure_ascii=False, indent=1))
PY
echo "$id $(python3 -c "import json;m=json.load(open('$R/meta.json'));print('model=%s cost=%s turns=%s sub=%s skillcalls=%s bash=%s outside=%s'%(m.get('model'),m.get('cost'),m.get('turns'),m.get('subtype'),m.get('skill_tool_calls'),m.get('bash_calls'),m.get('reads_outside')))")" | tee -a "$SP/log/summary.txt"
