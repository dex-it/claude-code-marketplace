#!/usr/bin/env bash
# Раннер группы 2.2 (#297): промпты кода и ревью, флаги исполнителя, выход в runs/<кейс>-<набор><N>/.
# run-group-2-2.sh <case> <set> <idx> [skill-file...]   case: g0, g-a, g-r, g-h, g-t, g-p, rv-a, rv-s, rv-h, rv-t, rv-c, rv0, k1
# k1 - кейс K1 протокола removed/dotnet-di (D20 dotnet-api-development): мини-проект Notify.Api, промпт кода по шаблону
# dotnet-ef-core/inputs/prompt-plain.md, поручение дословно из протокола.
# Рабочий каталог прогона - $G22_WORK (вне репозитория: на пути не должно быть CLAUDE.md).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/../_sandbox.sh"
# Воркеры MSBuild (/nodeReuse) и VBCSCompiler отсоединяются от прогона и копятся по 6 на сборку.
export MSBUILDDISABLENODEREUSE=1 DOTNET_CLI_USE_MSBUILD_SERVER=0 UseSharedCompilation=false
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${G22_WORK:?G22_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G22_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A BR=([g0]=volume-discount [g-a]=price-lists [g-r]=supplier-stock [g-h]=price-cache [g-t]=promo-tests [g-p]=supplier-sdk
 [rv-a]=supplier-portal [rv-s]=fx-rates [rv-h]=card-cache [rv-t]=b2b-quotes [rv-c]=price-exports [rv0]=store-clock)
declare -A HOME_=([g0]=dotnet-testing-patterns [g-t]=dotnet-testing-patterns [rv-t]=dotnet-testing-patterns
 [g-a]=dotnet-api-development [rv-a]=dotnet-api-development [rv0]=dotnet-api-development
 [g-r]=dotnet-resilience [rv-s]=dotnet-resilience [g-h]=removed/dotnet-caching [rv-h]=removed/dotnet-caching
 [g-p]=dotnet-csproj-hygiene [rv-c]=dotnet-csproj-hygiene [k1]=dotnet-api-development)
b=${BR[$case_]:-}; id="$case_-$set_$idx"
W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
if [[ $case_ == k1 ]]; then
  DIR=$W/Notify.Api; mkdir -p "$DIR"; cp -R "$T/removed/dotnet-di/inputs/code/." "$DIR"
  (cd "$DIR" && git init -q -b main && printf 'bin/\nobj/\n' > .gitignore && git add -A \
    && git -c user.name="Notify Team" -c user.email=notify@example.com commit -qm "Notify.Api") >/dev/null 2>&1 \
    || { echo "setup failed $id"; exit 1; }
  what="правила ASP.NET Core API, принятые в команде"
else
  DIR=$W/pricing
  bash $T/_projects/pricing/setup.sh "$DIR" "feature/$b" >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
  what="дисциплина, принятая в команде"
fi
add=(); sline=""
if ((${#skills[@]})); then mkdir -p $W/discipline; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$(dirname "$(dirname "$s")")" 2>/dev/null)-$(basename "$s")"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls $W/discipline/* | tr '\n' ' ' | sed 's/ $//') - $what.
"; fi
last=$(ls -d $T/_projects/pricing/branches/$b/*/ | tail -1)
if [[ $case_ == k1 ]]; then
  P="Ты .NET-разработчик в команде. Проект Notify.Api (ASP.NET Core 8, .NET 8) лежит в каталоге $DIR .
Прочитай его файлы и выполни поручение, записав код в этот каталог.
${sline}Поручение: Появляется второй канал уведомлений - SMS: добавь SmsSender : INotificationSender (пока пишет в лог). Подтверждение заказа (OrderService) теперь уходит по SMS. Добавь ReportsController с эндпоинтом POST /reports/{id}/send?email=..., который отправляет отчёт по email. Оба отправителя остаются за интерфейсом INotificationSender; используй keyed-сервисы .NET 8.
Ограничения: не вызывай Skill tool; не читай и не пиши локальные файлы вне этого каталога${skills:+, кроме названного SKILL.md}; не запускай сборку и dotnet. В ответе - список созданных/изменённых файлов и 2-3 строки о решениях; тот же ответ запиши в $DIR/_answer.md."
  tools=('Bash(git *)'); out=DIFF.patch
elif [[ $case_ == g* ]]; then
  task=$(cd $DIR && ls docs/tasks/ | grep -F "$(head -1 $T/_projects/pricing/branches/$b/1-task/COMMIT | grep -o 'PRC-[0-9]*')")
  P="Ты .NET-разработчик в команде. Git-репозиторий сервиса Pricing лежит в каталоге $DIR ; текущая ветка - feature/$b; задача - docs/tasks/$task.
${sline}Реализуй задачу в рабочем дереве. Не коммить.
Ограничения: не вызывай Skill tool; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}. Из команд доступны git и dotnet. В ответе - только список изменённых файлов."
  tools=('Bash(git *)' 'Bash(dotnet *)'); out=DIFF.patch
else
  desc=$(head -1 "$last/COMMIT")
  P="Ты .NET-ревьюер в команде. Git-репозиторий сервиса Pricing лежит в каталоге $DIR .
${sline}Сделай ревью MR: ветка feature/$b против main. Описание MR: «$desc»
Запиши находки в $DIR/REVIEW.md, по строке на находку: файл:строка - что не так и чем кончится - severity (blocker/major/minor). Без вступлений и резюме. Код не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; не читай и не пиши вне каталога репозитория${skills:+, кроме файлов дисциплины выше}. Сборки нет: из команд доступен только git. В ответе - только число находок по severity."
  tools=('Bash(git *)'); out=REVIEW.md
fi
cd "$DIR"
env "${GIT_SANDBOX_ENV[@]}" claude -p "$P" --disallowedTools "${GIT_DENY[@]}" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 3 \
  --tools Read Write Edit Glob Grep Bash --allowedTools "${tools[@]}" "${add[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$T/${HOME_[$case_]}/runs/$id; mkdir -p "$R"
if [[ $out == DIFF.patch ]]; then git add -A . || exit 1; git diff --cached > "$R/DIFF.patch"; else cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md"; fi
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
