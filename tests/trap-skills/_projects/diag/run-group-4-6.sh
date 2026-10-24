#!/usr/bin/env bash
# Раннер группы 4.6 (#307): исполнитель claude -p работает на хосте, команды лаборатории - через docker exec в контейнере diag46-<id>.
# run-group-4-6.sh <case> <set> <idx> [skill-file...]   case: d1 d3 p1 n1 n2 s1 b1 n0
# Каталог прогонов - $G46_WORK (вне репозитория, CLAUDE.md на пути нет); артефакты сборки - $G46_ART (build.sh в образе diag46-lab:1).
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"; P="$T/_projects/diag"
SP="${G46_WORK:?G46_WORK - каталог прогонов вне репозитория}"; ART="${G46_ART:?G46_ART - артефакты build.sh}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "G46_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; shift 3; skills=("$@")
declare -A HOME_=([d1]=managed-debug [d3]=core-dumps [p1]=perf-profiling [n1]=native-debug [n2]=native-debug [s1]=syscall-tracing [b1]=binary-inspection [n0]=managed-debug)
id="$case_-$set_$idx"; N="diag46-$id"; W="$SP/w/$id"; LAB="$W/lab"
rm -rf "$W"; mkdir -p "$LAB/logs" "$SP/log"; docker rm -f "$N" >/dev/null 2>&1
caps=(--cap-add SYS_PTRACE --security-opt seccomp=unconfined)
case $case_ in n2) caps=();; s1) caps=(--privileged);; esac
case $case_ in
  d1) cp -r "$ART/app" "$LAB/app"; mkdir "$LAB/src"; cp "$P/src/orders-worker/"{Program.cs,OrdersWorker.csproj} "$LAB/src/"; echo 'ORDERS_MAX_WORKERS=8' > "$LAB/orders-worker.env";;
  d3) cp -r "$ART/app" "$LAB/app"; mkdir "$LAB/src" "$LAB/dumps"; cp "$P/src/orders-worker/"{Program.cs,OrdersWorker.csproj} "$LAB/src/";;
  p1) cp -r "$ART/app" "$LAB/app"; mkdir "$LAB/src"; cp "$P/src/orders-worker/"{Program.cs,OrdersWorker.csproj} "$LAB/src/";;
  n1) mkdir -p "$LAB/prod" "$LAB/src" "$LAB/cores"; cp "$ART/native/crashme" "$LAB/prod/"; cp -r "$ART/symbols" "$LAB/symbols"; cp "$P/src/native/crashme.c" "$LAB/src/";;
  n2) mkdir -p "$LAB/bin" "$LAB/src"; cp "$ART/native/stockd" "$LAB/bin/"; cp "$P/src/native/deadlock.c" "$LAB/src/"; chmod -R a+rwX "$LAB";;
  s1) mkdir -p "$LAB/reportd/bin" "$LAB/reportd/conf/fx"; cp "$ART/native/"{aggregate,fxfetch} "$LAB/reportd/bin/"; cp "$P/cases/reportd/"{nightly.sh,reportd.env} "$LAB/reportd/"; cp "$P/cases/reportd/EUR.rate" "$LAB/reportd/conf/fx/";;
  b1) mkdir -p "$LAB/vendor"; cp "$ART/vendor/"* "$LAB/vendor/";;
  n0) mkdir -p "$LAB/notifier/logs"; cp "$P/cases/notifier/"* "$LAB/notifier/";;
esac
docker run -d --name "$N" --network none --cpus 4 --memory 3g "${caps[@]}" -v "$LAB:/work" diag46-lab:1 sleep infinity >/dev/null || { echo "run failed $id"; exit 1; }
dx() { docker exec "$N" "$@"; }
case $case_ in
  d1) dx sh -c 'cd /work && set -a && . ./orders-worker.env && set +a && setsid nohup dotnet app/OrdersWorker.dll hang > logs/worker.log 2>&1 &'; sleep 14;;
  d3) dx sh -c 'cd /work && DOTNET_DbgEnableMiniDump=1 DOTNET_DbgMiniDumpType=4 DOTNET_DbgMiniDumpName=/work/dumps/orders-worker.dmp dotnet app/OrdersWorker.dll fincrash >/dev/null 2>&1; true'; rm -f "$LAB"/dumps/*.ptr 2>/dev/null;;
  p1) dx sh -c 'cd /work && setsid nohup dotnet app/OrdersWorker.dll slow > logs/worker.log 2>&1 &'; sleep 8;;
  n1) dx sh -c 'cd /work/cores && ulimit -c unlimited && /work/prod/crashme >/dev/null 2>&1; true'; ls "$LAB/cores/core" >/dev/null || { echo "no core $id"; exit 1; };;
  n2) dx setpriv --reuid=1654 --regid=1654 --clear-groups sh -c 'setsid nohup /work/bin/stockd > /work/logs/stockd.log 2>&1 &'; sleep 6;;
  n0) dx sh -c 'cd /work/notifier && set -a && . ./notifier.env && set +a && sh ./notifier.sh; true';;
esac
[[ -n ${G46_DRY:-} ]] && exit 0
prompt_common="Ты инженер по эксплуатации. Лаборатория - Linux-контейнер $N (aarch64, .NET 8, установлены обычные инструменты отладки и профилирования); его каталог /work лежит на хосте как $LAB. Команды в контейнере выполняй только как \`docker exec $N <команда>\` (конвейер - \`docker exec $N sh -c '...'\`); сети нет. Читать и писать можно только внутри $LAB и в контейнере; не вызывай Skill tool. Код и конфигурацию сервиса не правь. Итог запиши файлом $LAB/REPORT.md: Симптом, Причина (файл:строка или ключ конфигурации), Улики (команда и фрагмент её вывода), Что предлагаешь. Без вступлений. В ответе - одна строка: суть причины."
case $case_ in
  d1) task="Сервис orders-worker (процесс dotnet, лог /work/logs/worker.log, исходники /work/src) перестал обрабатывать заказы: счётчик processed в логе стоит, процесс жив. Найди причину; вывод должен опираться на наблюдение живого процесса, а не на чтение исходников.";;
  d3) task="Сервис orders-worker упал ночью, лог потерян. Остался дамп /work/dumps/orders-worker.dmp (создан при падении средой выполнения, runtime тот же, что в контейнере); исходники /work/src. Найди причину падения; вывод должен опираться на дамп.";;
  p1) task="После релиза обработчик orders-worker (процесс dotnet, исходники /work/src) стал заметно медленнее: p50 вырос с 0.2 до 3 мс. Найди, где процесс тратит время. Сервис можно перезапустить: \`cd /work && dotnet app/OrdersWorker.dll slow\`. Вывод должен опираться на измерение, а не на чтение исходников.";;
  n1) task="Сервис report-agg упал по SIGSEGV. Остались core-файл /work/cores/core, prod-бинарь /work/prod/crashme (без символов), каталог /work/symbols с debug-файлами двух последних сборок и исходник /work/src/crashme.c. Найди функцию и строку падения и значение, которое к нему привело; вывод должен опираться на core.";;
  n2) task="Сервис stockd (процесс stockd, stdout в /work/logs/stockd.log, исходник /work/src/deadlock.c) перестал обновлять счётчики: процесс жив, CPU 0%. Найди причину; вывод должен опираться на наблюдение живого процесса.";;
  s1) task="Отчёт /work/reportd/nightly.sh печатает EUR равным USD (курс 1.0), в логах ни ошибок, ни предупреждений. Исходников вспомогательных программ нет, только бинарники в /work/reportd/bin. Найди причину.";;
  b1) task="Подрядчик прислал каталог /work/vendor: libcalc.so, vendor-tool, Legacy.Pricing.dll; исходников нет, файлы недоверенные. Ответь в REPORT.md (вместо раздела «Причина» - ответы): (1) какие C++-функции экспортирует libcalc.so (читаемые имена) и от каких библиотек зависит; (2) для какой архитектуры собран vendor-tool и что он печатает; (3) что делает Legacy.Pricing.Discounts.Apply: ставка, переменная окружения, исход.";;
  n0) task="Сервис notifier (/work/notifier/notifier.sh, окружение /work/notifier/notifier.env, лог /work/notifier/logs/notifier.log) не стартует после деплоя: код возврата 78. Выясни почему и скажи, что поправить.";;
esac
add=(); sline=""
if ((${#skills[@]})); then mkdir -p "$W/discipline"; for s in "${skills[@]}"; do cp "$s" "$W/discipline/$(basename "$s")"; done
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай файлы $(ls "$W"/discipline/* | tr '\n' ' ') - дисциплина, принятая в команде. "; fi
cd "$LAB"
claude -p "$sline$prompt_common
$task" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 2.5 \
  --tools Read Write Edit Glob Grep Bash --allowedTools "Bash(docker exec $N *)" "${add[@]}" \
  --output-format stream-json --verbose > "$SP/log/$id.jsonl" 2>"$SP/log/$id.err" &
cp=$!; ( sleep 1500; kill $cp 2>/dev/null ) >/dev/null 2>&1 & wd=$!; wait $cp; pkill -P $wd 2>/dev/null; kill $wd 2>/dev/null
R="$T/${HOME_[$case_]}/runs/$id"; mkdir -p "$R"
cp "$LAB/REPORT.md" "$R/REPORT.md" 2>/dev/null || echo "(нет REPORT.md)" > "$R/REPORT.md"
python3 - "$SP/log/$id.jsonl" "$R/commands.txt" "$LAB" "$W" "$SP" "$N" "$REPO" <<'PY'
import json,sys
log,out,lab,w,sp,n,repo=sys.argv[1:]
cmds=[];bad=set();cost="";ver="";sk=None;mcp=None
for l in open(log):
  try: m=json.loads(l)
  except: continue
  if m.get("type")=="system" and m.get("subtype")=="init": ver=m.get("claude_code_version");sk=m.get("skills");mcp=m.get("mcp_servers")
  if m.get("type")=="result": cost=(m.get("total_cost_usd"),m.get("subtype"),m.get("num_turns"))
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      i=c.get("input",{}); nm=c.get("name")
      if nm=="Bash": cmds.append(i.get("command",""))
      else:
        p=i.get("file_path") or i.get("path") or ""
        cmds.append(f"[{nm}] {p}")
        if p.startswith("/") and not (p.startswith(lab) or p.startswith(w+"/discipline")): bad.add(p)
      if repo in str(i) or "/.claude/" in str(i): bad.add("cmd")
txt="\n".join(cmds).replace(lab,"<lab>").replace(w,"<run>").replace(n,"<ctr>")
open(out,"w").write(txt+"\n")
print(f"cli={ver} skills={sk} mcp={mcp} cost={cost} esc={sorted(bad)}")
PY
echo "$id done" | tee -a "$SP/log/summary.txt"
docker rm -f "$N" >/dev/null 2>&1
