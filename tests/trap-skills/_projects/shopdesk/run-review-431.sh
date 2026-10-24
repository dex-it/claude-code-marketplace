#!/usr/bin/env bash
# Раннер кейса ревью V3, V9, V10 ts-vitest-jest (#431, остаток #321). НЕ ЗАПУСКАЛСЯ: ключ, правило числа прогонов и порог -
# в README набора (tests/trap-skills/ts-vitest-jest/README.md, «Заход #431») и в «K3R» README мини-проекта. Образец - run-group-321.sh;
# промпт ревью - как у R1, R2 (ts-nodejs-api/README.md, «Промпт ревью»).
# run-review-431.sh <case> <set> <idx> [skill-file...]   case: rv (K3R, ветка feature/checkout-tests-mr1), rn (K3RN, ветка
#   feature/checkout-tests-mr2, «ничего не менять»); set: c - контроль без скилла, s - со скиллом.
#   skill-file - редакция SKILL.md (tests/trap-skills/ts-vitest-jest/inputs/SKILL-*.md, подавать 2.2.0); без него - контроль.
# Каталог прогонов - $G431_WORK (вне репозитория: на пути не должно быть CLAUDE.md). Выход - ts-vitest-jest/runs/<case>-<set><idx>/.
# Мины (детерминированная проверка сида, без модели): mines/K3R/run.sh <repo>; судья считает находки в REVIEW.md по ключу K3R/K3RN вручную.
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G431_WORK:?G431_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G431_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
[[ -e $HOME/.claude/CLAUDE.md ]] && { echo "есть ~/.claude/CLAUDE.md"; exit 1; }
P="$T/_projects/shopdesk"
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([rv]=checkout-tests-mr1 [rn]=checkout-tests-mr2)
b=${BR[$case_]:?unknown case $case_}; id="$case_-$set_$idx"
if [[ $set_ == c && ${#skills[@]} -gt 0 ]]; then echo "набор c - контроль, скилл не подаётся"; exit 1; fi
if [[ $set_ == s && ${#skills[@]} -eq 0 ]]; then echo "набор s требует skill-file"; exit 1; fi
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
PROMPT="Ты TypeScript-ревьюер в команде. Git-репозиторий проекта Shopdesk (монорепозиторий: api на Express, web на React, e2e) лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка feature/$b против feature/checkout-tests. Описание MR: «Unit-тесты по задаче docs/tasks/SD-18-checkout-tests.md: расчёт стоимости заказа, промокод, недоступная доставка, лимит попыток оформления.»
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
Зависимости установлены (node_modules), внешней сети нет; доступны git, npm run typecheck, npm test, npx tsc, npx vitest.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; не читай и не пиши вне каталога репозитория${outside}. В ответе - только число находок по severity."
cd "$DIR"
claude -p "$PROMPT" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1 --max-turns 150 \
  --settings "$SP/sandbox.json" --tools Read,Write,Edit,Glob,Grep,Bash --allowed-tools Read,Write,Edit,Glob,Grep,Bash "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
R=$T/ts-vitest-jest/runs/$id; rm -rf "$R"; mkdir -p "$R"
clean() { sed -e "s#$DIR#<run>#g" -e "s#$W#<work>#g" -e "s#$SP#<work>#g" -e "s#$REPO#<repo>#g" -e "s#$HOME#~#g"; }
printf '%s\n' "$PROMPT" | clean > "$R/prompt.txt"
if [[ -f $DIR/REVIEW.md ]]; then clean < "$DIR/REVIEW.md" > "$R/REVIEW.md"; else echo "REVIEW.md нет" > "$R/REVIEW.md"; fi
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
{ # grade.txt: репозиторий не тронут (кроме REVIEW.md), сид на месте
  echo "case=$case_"
  echo "changed: $(git -C "$DIR" status --porcelain | grep -v 'REVIEW.md' | tr '\n' ' ')"
  bash "$P/mines/K3R/run.sh" "$DIR"
} 2>&1 | clean > "$R/grade.txt"
python3 - "$SP/log/$id.jsonl" "$DIR" "$W/rules" > "$R/meta.json" <<'PY'
import json,sys
log,d,rules=sys.argv[1:]
bad=set(); skill=0; bash=[]
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
