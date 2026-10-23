#!/usr/bin/env bash
# Раннер задачи #209, п. 2.1: нарезка правил с недосказанностью на мини-проекте Rooms (кейс w5, вариант ambig),
# выход в user-stories/runs/<кейс>-<набор><N>/. Образец - run-group-3-1.sh, устройство то же.
# run-209.sh <case> <set> <idx> [skill-file...]   case: w5
# Рабочий каталог прогона - $G209_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
H="$(cd "$(dirname "$0")" && pwd)"
SP="${G209_WORK:?G209_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$H" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G209_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
F='фичи 02 «Часы сверх пакета»'
declare -A T=(
 [w5]="Требования $F готовы. Нарежь правила FR-2021, FR-2022, FR-2023 и FR-2024 (srs.md) на пользовательские истории с критериями приёмки для команды разработки: остальные правила разбирает другой аналитик. Истории - в docs/requirements/02-overtime/stories.md.")
declare -A VAR=([w5]=ambig)
task="${T[$case_]:?неизвестный кейс}"; variant="${VAR[$case_]}"
role="Ты системный аналитик команды и ведёшь требования продукта."
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
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1.5 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$REPO/tests/trap-skills/user-stories/runs/$id; mkdir -p "$R"
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
