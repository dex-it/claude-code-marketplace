#!/usr/bin/env bash
# Раннер кейсов «инструкции и гайды проекта» (#341): промпты фичи и ревью, флаги исполнителя, выход в
# codebase-conventions/runs/guides-<кейс>-<набор><N>/.
# run-guides.sh <case> <set> <idx> [skill-file]   case: f (CG-F, фича), r (CG-R, ревью MR), n (CG-0, ревью, ничего не менять)
# set: c - контроль без скилла; s - со скиллом (копия SKILL.md подаётся путём). idx - номер прогона.
# GUIDES_VER=v2 - версия кейса в id прогона (guides-n-v2-c1): прогоны после правки кейса не затирают прежние.
# Рабочий каталог прогона - $GUIDES_WORK (вне репозитория: на его пути не должно быть CLAUDE.md).
# CLAUDE.md кейса лежит внутри мини-проекта (ветка guides-base) - это часть входа, в каталог прогона
# попадает вместе с репозиторием; проверка пути ниже смотрит только на предков $GUIDES_WORK.
# GUIDES_DRY=1 - собрать репозиторий и промпт, claude не вызывать.
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${GUIDES_WORK:?GUIDES_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "GUIDES_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; skill="${4:-}"
id="guides-$case_${GUIDES_VER:+-$GUIDES_VER}-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/billing
declare -A BR=([f]=guides-base [r]=overdue-list [n]=customer-invoices)
declare -A DESC=(
 [r]="Просроченные счета для сборщиков: GET /invoices/overdue, постраничная выдача."
 [n]="Список счетов клиента для личного кабинета: GET /invoices?customerId=, постраничная выдача.")
bash "$T/_projects/billing/setup.sh" "$DIR" "feature/${BR[$case_]}" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
# в репозитории остаются main, база кейса и ветка кейса: чужие ветки решений исполнителю не видны
(cd "$DIR" && for b in $(git for-each-ref --format='%(refname:short)' refs/heads); do
   case $b in main|feature/guides-base|feature/${BR[$case_]}) ;; *) git branch -q -D "$b";; esac; done
 git reflog expire --expire=now --all && git gc -q --prune=now) || { echo "cleanup failed $id"; exit 1; }
sline=""; add=()
if [[ -n $skill ]]; then
  mkdir -p "$W/discipline"; cp "$skill" "$W/discipline/codebase-conventions.md"
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $W/discipline/codebase-conventions.md - дисциплина, принятая в команде.
"
fi
if [[ $case_ == f ]]; then
  P="Ты .NET-разработчик в команде. Git-репозиторий сервиса Billing лежит в каталоге $DIR ; текущая ветка - feature/guides-base.
${sline}Поручение: «Список счетов клиента для личного кабинета: GET /invoices?customerId=... Возвращает счета этого клиента, новые сверху. Выдача постраничная.»
Код пиши в репозиторий, не коммить.
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skill:+, кроме файла дисциплины выше}. Сборки нет: из команд доступен только git. В ответе - только список изменённых файлов."
  out=DIFF.patch
else
  P="Ты .NET-ревьюер в команде. Git-репозиторий сервиса Billing лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка feature/${BR[$case_]} против feature/guides-base. Описание MR: «${DESC[$case_]}»
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; не читай и не пиши вне каталога репозитория${skill:+, кроме файла дисциплины выше}. Сборки нет: из команд доступен только git. В ответе - только число находок по severity."
  out=REVIEW.md
fi
[[ ${GUIDES_DRY:-} == 1 ]] && { echo "$P"; exit 0; }
cd "$DIR"
head=$(git rev-parse --short HEAD)
claude -p "$P" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1.5 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err"
R=$T/codebase-conventions/runs/$id; mkdir -p "$R"
if [[ $out == DIFF.patch ]]; then
  git add -A -N . || exit 1; git diff > "$R/DIFF.patch"
else
  cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md"
fi
python3 - "$SP/log/$id.jsonl" "$R/meta.json" "$id" "$head" "${skill:+$(basename "$skill")}" <<'PY'
import json, sys
log, out, rid, head, disc = sys.argv[1:6]
init, res = {}, {}
use, results = [], []
for l in open(log):
    try: m = json.loads(l)
    except Exception: continue
    if m.get("type") == "system" and m.get("subtype") == "init": init = m
    if m.get("type") == "result": res = m
    msg = m.get("message")
    if isinstance(msg, dict) and isinstance(msg.get("content"), list):
        for c in msg["content"]:
            if not isinstance(c, dict): continue
            if c.get("type") == "tool_use": use.append(json.dumps(c.get("input", {}), ensure_ascii=False))
            if c.get("type") == "tool_result": results.append(json.dumps(c.get("content", ""), ensure_ascii=False))
# источники: открыт ли файл (по вызову) и попало ли его содержимое в выдачу (маркер текста)
def seen(name, marker):
    return {"called": any(name in u for u in use), "in_output": any(marker in r for r in results)}
src = {"CLAUDE.md": seen("CLAUDE.md", "Нормы проекта"),
       "guide": seen("api-lists", "непрозрачная строка"),
       "note": seen("notes/invoice-lists", "Фронт рисует номера страниц")}
json.dump({"id": rid, "model": init.get("model"), "cli": init.get("claude_code_version"), "repo_head": head,
           "discipline": disc or None, "cost_usd": res.get("total_cost_usd"), "turns": res.get("num_turns"),
           "duration_ms": res.get("duration_ms"), "subtype": res.get("subtype"), "sources": src},
          open(out, "w"), ensure_ascii=False, indent=1)
print(rid, res.get("total_cost_usd"), res.get("subtype"), res.get("num_turns"), json.dumps(src, ensure_ascii=False))
PY
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
