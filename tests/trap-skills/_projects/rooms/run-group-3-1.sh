#!/usr/bin/env bash
# Раннер группы 3.1 (#300): поручение аналитику на мини-проекте Rooms, выход в requirement-quality/runs/<кейс>-<набор><N>/.
# run-group-3-1.sh <case> <set> <idx> [skill-file...]   case: w1 w2 w2n w3 w4 r1 r2 r3 r4 r5 r6 r7 r8 r9 c0 g1
# Рабочий каталог прогона - $G31_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
H="$(cd "$(dirname "$0")" && pwd)"
SP="${G31_WORK:?G31_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$H" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G31_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
F='фичи 02 «Часы сверх пакета»'
NOEDIT='Файлы не правь - владелец сначала посмотрит список.'
declare -A T=(
 [w1]="Владелец продукта собрал бриф и провёл интервью по новой фиче - часы сверх пакета (docs/brief/02-overtime/). Подготовь бизнес-требования фичи."
 [w2]="Бизнес-требования и сценарии $F готовы. Выведи требования системного уровня - функциональные и нефункциональные - для разработки."
 [w2n]="Бизнес-требования $F готовы, сценарии ещё в работе у другого аналитика. Займись нефункциональными требованиями фичи."
 [w3]="Бизнес-требования $F готовы. Разбери их в сценарии использования."
 [w4]="Требования $F готовы. Нарежь фичу на пользовательские истории с критериями приёмки для команды разработки."
 [r1]="Перед передачей в разработку проверь требования системного уровня $F (srs.md) и подготовь владельцу продукта список: что исправить и что требует его решения. $NOEDIT"
 [r2]="Перед передачей в разработку проверь требования системного уровня $F (srs.md) и подготовь владельцу продукта список: что исправить и что требует его решения. $NOEDIT"
 [r3]="Другой аналитик переработал сценарии $F (usecases.md). Проверь их перед тем, как по ним пойдут требования, и подготовь ему список замечаний. Файлы не правь."
 [r4]="Завтра планирование спринта 21: команда берёт истории $F (stories.md, бэклог - docs/planning/backlog.md). Проверь истории и бэклог и подготовь список: что исправить до планирования и что требует решения владельца продукта. $NOEDIT"
 [r6]="Перед передачей в разработку проверь требования системного уровня $F (srs.md) и подготовь владельцу продукта список: что исправить и что требует его решения. $NOEDIT"
 [r7]="Завтра планирование спринта 21: команда берёт истории $F (stories.md, бэклог - docs/planning/backlog.md). Проверь истории и бэклог и подготовь список: что исправить до планирования и что требует решения владельца продукта. $NOEDIT"
 [r8]="Завтра планирование спринта 21: команда берёт истории $F (stories.md, бэклог - docs/planning/backlog.md). Проверь истории и бэклог и подготовь список: что исправить до планирования и что требует решения владельца продукта. $NOEDIT"
 [r9]="Завтра планирование спринта 21: команда берёт истории $F (stories.md, бэклог - docs/planning/backlog.md). Проверь истории и бэклог и подготовь список: что исправить до планирования и что требует решения владельца продукта. $NOEDIT"
 [r5]="Команда разработки спрашивает, можно ли брать $F в работу. Дай ответ с обоснованием. Файлы не правь."
 [c0]="Владелец продукта спрашивает: сотрудник отменил обычную бронь за полтора часа до встречи - что будет с часами компании и почему? Подготовь ему ответ со ссылками на требования."
 [g1]="Поддержка завела тикет tickets/ROOM-57.md. Подготовь по нему цель задачи для разработчика - файл goal.md в корне репозитория: цель одной фразой; критерий «готово» - чем, не читая код, отличить сделанное от несделанного; граница - чего не делаем. Каждое утверждение - со ссылкой на источник (файл, раздел, номер требования) либо с пометкой «допущение».")
declare -A VAR=([w1]=brief [w2]=uc [w2n]=brd [w3]=brd [w4]=srs [r1]=badunit [r2]=badset [r3]=baduc [r4]=badst [r5]=ready [r6]=baddesign [r7]=badinvest [r8]=goodinvest [r9]=ring3 [c0]=srs [g1]=ticket)
task="${T[$case_]:?неизвестный кейс}"; variant="${VAR[$case_]}"
role="Ты системный аналитик команды и ведёшь требования продукта."; [[ $case_ == g1 ]] && role="Ты аналитик команды и готовишь задачи для разработчиков."
id="$case_-$set_$idx"; W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"; DIR=$W/repo
bash "$H/setup.sh" "$DIR" "$variant" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
add=(); sline=""
if ((${#skills[@]})); then mkdir -p $W/discipline; for s in "${skills[@]}"; do d=$(basename "$(dirname "$s")"); [[ $d == inputs ]] && d=$(basename "$(dirname "$(dirname "$s")")"); cp "$s" "$W/discipline/$d-$(basename "$s")"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls $W/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
P="$role Git-репозиторий продукта лежит в каталоге $DIR .
${sline}Поручение: ${task}
Работай в рабочем дереве, не коммить. Владельца продукта спросить сейчас нельзя.
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}. Из команд доступен только git. В ответе - изменённые файлы и всё, что требует решения владельца продукта."
cd "$DIR"
claude -p "$P" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$REPO/tests/trap-skills/requirement-quality/runs/$id; mkdir -p "$R"
git add -A -N . || exit 1; git diff > "$R/DIFF.patch"
tail -1 $SP/log/$id.jsonl | python3 -c 'import json,sys;print(json.load(sys.stdin).get("result",""))' > "$R/ANSWER.md" 2>/dev/null
cost=$(tail -1 $SP/log/$id.jsonl | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("total_cost_usd"),d.get("subtype"))' 2>/dev/null)
esc=$(python3 - "$SP/log/$id.jsonl" "$DIR" "$W/discipline" "$REPO" <<'PY'
import json,sys
log,d,disc,repo=sys.argv[1:]
bad=set(); reads=set()
for l in open(log):
  try: m=json.loads(l)
  except: continue
  for c in (m.get("message",{}) or {}).get("content",[]) if isinstance(m.get("message"),dict) else []:
    if isinstance(c,dict) and c.get("type")=="tool_use":
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if c.get("name")=="Skill": bad.add("Skill")
      if p.startswith(disc): reads.add(p.rsplit("/",1)[-1])
      if p.startswith("/") and not (p.startswith(d) or p.startswith(disc)): bad.add(p)
      cmd=i.get("command","")
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
print(";".join(sorted(bad))+" | read:"+",".join(sorted(reads)))
PY
)
echo "$id cost=$cost esc=[${esc}]" | tee -a $SP/log/summary.txt
