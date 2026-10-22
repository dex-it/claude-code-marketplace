#!/usr/bin/env bash
# Раннер набора «большой репозиторий» (#311): промпты фичи и ревью, флаги исполнителя, выход в
# codebase-conventions/runs/big-<кейс>-<набор><N>/.
# run-big-repo.sh <case> <set> <idx> [skill-file]   case: f1 (фича), r1 (ревью), n0 (ревью, ничего не менять)
# set: c - контроль без скилла; s - со скиллом (копия SKILL.md подаётся путём). idx - номер прогона.
# Рабочий каталог прогона - $BIG_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
# BIG_DRY=1 - собрать репозиторий и промпт, claude не вызывать.
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${BIG_WORK:?BIG_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "BIG_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; skill="${4:-}"
id="big-$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/meridian
declare -A BR=([f1]=main [r1]=feature/partial-refunds [n0]=feature/tariff-cache)
declare -A DESC=(
 [r1]="Частичный возврат платежа: POST /v1/payments/{id}/refunds с суммой и причиной. Возврат проводится у PSP синхронно, сервис Orders узнаёт о нём событием."
 [n0]="Кэш тарифов в процессе: тарифы от Pricing кэшируются на 5 минут, чтобы не ходить в Pricing на каждый запрос списка.")
bash "$T/_projects/meridian/setup.sh" "$DIR" "${BR[$case_]}" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
sline=""; add=()
if [[ -n $skill ]]; then
  mkdir -p "$W/discipline"; cp "$skill" "$W/discipline/codebase-conventions.md"
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $W/discipline/codebase-conventions.md - дисциплина, принятая в команде.
"
fi
if [[ $case_ == f1 ]]; then
  P="Ты .NET-разработчик в команде. Git-репозиторий платформы Meridian лежит в каталоге $DIR ; текущая ветка - main.
${sline}Поручение: «Расчёт стоимости доставки в сервисе Shipping: POST /v1/shipments/{id}/quote. Стоимость и срок запрашиваются у API перевозчика (внешний API, описание - docs/specs/carrier-api.md), результат сохраняется в отправлении, о нём узнаёт сервис Orders. Котировка доступна, пока отправление не передано перевозчику; повторный запрос заменяет прежнюю. Котировка действует 24 часа.»
Код пиши в репозиторий, не коммить. Результат работы - ещё и файл PR.md в корне репозитория (не коммить): список изменённых файлов и описание изменения для ревью; по каждому нетривиальному техническому решению - что выбрано и почему.
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skill:+, кроме файла дисциплины выше}. Сборки нет: из команд доступен только git. В ответе - только список изменённых файлов."
  tools=('Bash(git *)')
else
  P="Ты .NET-ревьюер в команде. Git-репозиторий платформы Meridian лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка ${BR[$case_]} против main. Описание MR: «${DESC[$case_]}»
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; не читай и не пиши вне каталога репозитория${skill:+, кроме файла дисциплины выше}. Сборки нет: из команд доступен только git. В ответе - только число находок по severity."
  tools=('Bash(git *)')
fi
[[ ${BIG_DRY:-} == 1 ]] && { echo "$P"; exit 0; }
cd "$DIR"
head=$(git rev-parse --short HEAD)
claude -p "$P" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools Read Write Edit Glob Grep Bash --allowedTools "${tools[@]}" "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
R=$T/codebase-conventions/runs/$id; mkdir -p "$R"
if [[ $case_ == f1 ]]; then
  git add -A -N . || exit 1; git diff > "$R/DIFF.patch"; cp PR.md "$R/PR.md" 2>/dev/null || echo "(нет PR.md)" > "$R/PR.md"
else
  cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md"
fi
python3 - "$SP/log/$id.jsonl" "$R/meta.json" "$id" "$head" "${skill:+$(basename "$skill")}" <<'PY'
import json, sys
log, out, rid, head, disc = sys.argv[1:6]
init, res = {}, {}
for l in open(log):
    try: m = json.loads(l)
    except Exception: continue
    if m.get("type") == "system" and m.get("subtype") == "init": init = m
    if m.get("type") == "result": res = m
json.dump({"id": rid, "model": init.get("model"), "cli": init.get("claude_code_version"), "repo_head": head,
           "discipline": disc or None, "cost_usd": res.get("total_cost_usd"), "turns": res.get("num_turns"),
           "duration_ms": res.get("duration_ms"), "subtype": res.get("subtype")}, open(out, "w"), ensure_ascii=False, indent=1)
print(rid, res.get("total_cost_usd"), res.get("subtype"), res.get("num_turns"))
PY
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
echo "$id esc=[${esc}]" | tee -a "$SP/log/summary.txt"
