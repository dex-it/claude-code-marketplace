#!/usr/bin/env bash
# Раннер группы 2.1 (#296): промпты кода и ревью, флаги исполнителя, выход в runs/<кейс>-<набор><N>/.
# run-group-2-1.sh <case> <set> <idx> [skill-file...]   case: g0..g4, rv-l1, rv-l2, rv-r, rv-a, rv-v, rv-q, rv0
# Рабочий каталог прогона - $G21_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G21_WORK:?G21_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G21_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([g0]=money-allocate [g1]=invoice-pdf [g2]=bank-statement [g3]=price-plans [g4]=notifications-service
 [rv-l1]=invoice-notify [rv-l2]=payment-reconcile [rv-r]=accounting-archive [rv-a]=fx-rates-refresh [rv-v]=partner-import [rv-q]=build-hardening [rv0]=overdue-digest)
declare -A HOME_=([g0]=dotnet-async-patterns [g1]=dotnet-async-patterns [g2]=dotnet-async-patterns [rv-a]=dotnet-async-patterns
 [g3]=dotnet-validation [rv-v]=dotnet-validation [rv0]=dotnet-validation [rv-l1]=dotnet-logging [rv-l2]=dotnet-logging
 [rv-r]=removed/dotnet-resources [g4]=dotnet-code-quality [rv-q]=dotnet-code-quality)
b=${BR[$case_]}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/billing
bash $T/_projects/billing/setup.sh "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""
if ((${#skills[@]})); then mkdir -p $W/discipline; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$(dirname "$(dirname "$s")")" 2>/dev/null)-$(basename "$s")"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls $W/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
last=$(ls -d $T/_projects/billing/branches/$b/*/ | tail -1)
if [[ $case_ == g* ]]; then
  task=$(cd $DIR && ls docs/tasks/ | grep -F "$(head -1 $T/_projects/billing/branches/$b/1-task/COMMIT | grep -o 'BILL-[0-9]*')")
  P="Ты .NET-разработчик в команде. Git-репозиторий сервиса Billing лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/$task.
${sline}Реализуй задачу в рабочем дереве. Не коммить.
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}. Из команд доступны git и dotnet. В ответе - только список изменённых файлов."
  tools=('Bash(git *)' 'Bash(dotnet *)'); out=DIFF.patch
else
  desc=$(head -1 "$last/COMMIT")
  P="Ты .NET-ревьюер в команде. Git-репозиторий сервиса Billing лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка feature/$b против main. Описание MR: «$desc»
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}. Сборки нет: из команд доступен только git. В ответе - только число находок по severity."
  tools=('Bash(git *)'); out=REVIEW.md
fi
cd "$DIR"
claude -p "$P" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools Read Write Edit Glob Grep Bash --allowedTools "${tools[@]}" "${add[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$T/${HOME_[$case_]}/runs/$id; mkdir -p "$R"
if [[ $out == DIFF.patch ]]; then git add -A -N . || exit 1; git diff > "$R/DIFF.patch"; else cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md"; fi
cost=$(tail -1 $SP/log/$id.jsonl | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("total_cost_usd"),d.get("subtype"))' 2>/dev/null)
# пути вне каталога прогона
esc=$(python3 - "$SP/log/$id.jsonl" "$DIR" "$W/discipline" "$REPO" <<'PY'
import json,sys
log,d,disc,repo=sys.argv[1:]
bad=set()
for l in open(log):
  try: m=json.loads(l)
  except: continue
  for c in (m.get("message",{}) or {}).get("content",[]) if isinstance(m.get("message"),dict) else []:
    if isinstance(c,dict) and c.get("type")=="tool_use":
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if p.startswith("/") and not (p.startswith(d) or p.startswith(disc)): bad.add(p)
      cmd=i.get("command","")
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
print(";".join(sorted(bad)))
PY
)
echo "$id cost=$cost esc=[${esc}]" | tee -a $SP/log/summary.txt
