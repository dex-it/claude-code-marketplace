#!/usr/bin/env bash
# Регрессия сторожа дерева (issue #252, P34): узел трека стартует в дереве открытой цели и дерево сессии не трогает.
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
G="$H/tree-guard.py"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }

export CLAUDE_CONFIG_DIR="$T/config"
R="$T/repo"; mkdir -p "$R"
# Адрес ledger и корень дерева считаются от него: без подмены цель уедет в ledger рабочего проекта.
# Скриптам главного потока - DEX_AUTO_CWD, хукам - CLAUDE_PROJECT_DIR (P35): cwd события узла - его дерево.
export DEX_AUTO_CWD="$R" CLAUDE_PROJECT_DIR="$R"
git -C "$R" init -q -b main; git -C "$R" config user.email t@t; git -C "$R" config user.name t
echo one > "$R/a.txt"; git -C "$R" add -A; git -C "$R" commit -qm first

# Событие PreToolUse: собирается тем же python3, что разбирает его сторож, - кавычки в команде штатны.
# Субагент Agent оператора (id op1) отличается от узла Workflow (id a1) только своим транскриптом (P33).
# cwd события - HERE: узел, запущенный после входа главного потока в дерево, стартует в нём (P34).
TR="$T/proj/s.jsonl"; mkdir -p "$T/proj/s/subagents"; : > "$TR"; : > "$T/proj/s/subagents/agent-op1.jsonl"
ev() { python3 -c 'import json,sys
d={"hook_event_name":"PreToolUse","session_id":"s","cwd":sys.argv[1],"tool_name":sys.argv[2],"tool_input":json.loads(sys.argv[3])}
if sys.argv[4]: d["agent_id"]=sys.argv[5]; d["agent_type"]=sys.argv[4]
if sys.argv[6]: d["transcript_path"]=sys.argv[6]
print(json.dumps(d))' "${HERE:-$R}" "$1" "$2" "${3-workflow-subagent}" "${4-a1}" "${5-$TR}"; }
run() { ev "$@" | "$G"; }
verdict() { python3 -c 'import json,sys
t=sys.stdin.read().strip()
print(json.loads(t)["hookSpecificOutput"]["permissionDecision"] if t else "allow")'; }
reason() { python3 -c 'import json,sys; print(json.load(sys.stdin)["hookSpecificOutput"]["permissionDecisionReason"])'; }

# Целей нет вовсе.
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "allow" "открытых целей нет - сторож молчит"

"$H/ledger.py" open PROJ-1 autonomous >/dev/null
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "allow" "цель открыта, дерева нет - сторож молчит"

W="$("$H/worktree.py" path PROJ-1 2>/dev/null)"
check "$([ -d "$W" ] && echo есть || echo нет)" "есть" "дерево трека заведено"
check "$("$H/worktree.py" main)" "$R" "worktree.py main отдаёт корень дерева сессии"

# Главный поток не вошёл в дерево: узел стартует в дереве сессии, и любой его вызов отбит, даже в дерево трека.
check "$(run Bash '{"command":"cd '"$W"' && npm test"}' | verdict)" "deny" "узел в дереве сессии: Bash отбит, даже с cd в дерево трека"
check "$(run Write '{"file_path":"'"$W"'/x.txt"}' | verdict)" "deny" "узел в дереве сессии: запись в дерево трека отбита"
check "$(run Bash '{"command":"npm test"}' | reason | grep -c 'не вошёл')" "1" "отказ называет причину: главный поток не вошёл в дерево"
check "$(run Bash '{"command":"npm test"}' | reason | grep -c 'другого Workflow')" "1" "отказ называет исход и узлу чужого Workflow, событием от узла трека не отличимому"
mkdir -p "$R/sub"
check "$(HERE="$R/sub" run Write '{"file_path":"'"$W"'/x.txt"}' | verdict)" "deny" "узел в подкаталоге дерева сессии отбит"

HERE="$W"

# Область: узлы движка, не любой субагент и не любой инструмент.
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' '' | verdict)" "allow" "главный поток (без agent_id) не сторожится"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' op1 | verdict)" "allow" "субагент оператора со своим транскриптом Agent не сторожится"
check "$(run Bash '{"command":"rg TODO"}' 'dex-self-reviewer' op1 | verdict)" "allow" "субагент-ревьюер оператора не сторожится"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' 'general-purpose' | verdict)" "deny" "узел Workflow с agentType general-purpose сторожится"
check "$(run Bash '{"command":"touch '"$R"'/x"}' 'dex-implementer-reader:implementer-reader' | verdict)" "deny" "узел Workflow с agentType агента каталога сторожится"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' a9 | verdict)" "deny" "субагент без транскрипта Agent сторожится - раскладка не опознана"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' op1 '' | verdict)" "deny" "событие без transcript_path сторожится - опознать субагента Agent нечем"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' op1 "$T/proj/s" | verdict)" "deny" "transcript_path не на .jsonl сторожится"
check "$(run Read '{"file_path":"'"$R"'/a.txt"}' | verdict)" "allow" "Read не сторожится - чтение чужого дерева законно"
check "$(run Grep '{"pattern":"x","path":"'"$R"'"}' | verdict)" "allow" "Grep не сторожится"

# Запись.
check "$(run Write '{"file_path":"'"$W"'/new.txt"}' | verdict)" "allow" "Write в дерево трека разрешён"
check "$(run MultiEdit '{"file_path":"'"$W"'/new.txt"}' | verdict)" "allow" "MultiEdit в дерево трека разрешён"
check "$(run NotebookEdit '{"notebook_path":"'"$W"'/n.ipynb"}' | verdict)" "allow" "NotebookEdit в дерево трека разрешён - поле notebook_path"
check "$(run NotebookEdit '{"notebook_path":"'"$R"'/n.ipynb"}' | verdict)" "deny" "NotebookEdit в общее дерево отбит"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "deny" "Write в общее дерево отбит"
check "$(run Edit '{"file_path":"'"$R"'/a.txt"}' | verdict)" "deny" "Edit в общее дерево отбит"
check "$(run Write '{"file_path":"a.txt"}' | verdict)" "allow" "Write относительным путём разрешён - он резолвится в дереве трека"
check "$(run Write '{"file_path":"'"$R"'0/x.txt"}' | verdict)" "allow" "каталог с именем-приставкой дерева сессии в него не ведёт"
check "$(CLAUDE_PROJECT_DIR="$R" DEX_AUTO_CWD= run Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "deny" "ledger найден по каталогу запуска сессии, не по cwd события в дереве"
check "$(run Write '{}' | verdict)" "deny" "Write без предмета вызова отбит"

# Путь канонизируется: лексическая сверка выпускала наружу через переход вверх и симлинк.
check "$(run Write '{"file_path":"'"$W"'/../'"$(basename "$R")"'/a.txt"}' | verdict)" "deny" "переход вверх из дерева в общее отбит"
ln -sfn "$R" "$W/escape"
check "$(run Write '{"file_path":"'"$W"'/escape/evil.txt"}' | verdict)" "deny" "симлинк из дерева в дерево сессии отбит"
rm -f "$W/escape"

# Bash: процесс уже в дереве, отбивается только путь в дерево сессии.
check "$(run Bash '{"command":"cd '"$W"' && npm test"}' | verdict)" "allow" "Bash с cd в дерево разрешён"
check "$(run Bash '{"command":"git -C '"$W"' commit -m x"}' | verdict)" "allow" "Bash с путём дерева в аргументе разрешён"
check "$(run Bash '{"command":"npm test"}' | verdict)" "allow" "относительный Bash разрешён - он стартует в дереве трека"
check "$(run Bash '{"command":"git add -A && git commit -m x"}' | verdict)" "allow" "коммит в рабочем каталоге разрешён"
check "$(run Bash '{"command":"cd '"$R"' && npm test"}' | verdict)" "deny" "cd в дерево сессии отбит"
check "$(run Bash '{}' | verdict)" "deny" "Bash без команды отбит - пустой предмет сверке не подлежит"
check "$(run Bash '{"command":"cd '"$W"' && npm test; cd '"$R"' && git push"}' | verdict)" "deny" "составная команда с законным префиксом отбита на втором звене"
check "$(run Bash '{"command":"rm -rf '"$R"'/a.txt && : '"$W"'"}' | verdict)" "deny" "упоминание дерева в no-op не оправдывает команду по общему дереву"
check "$(run Bash '{"command":"rm -rf '"$R"'0/x"}' | verdict)" "allow" "каталог с именем-приставкой дерева сессии в него не ведёт"
check "$(run Bash '{"command":"cat '"$W"'/../'"$(basename "$R")"'/a.txt"}' | verdict)" "deny" "переход вверх внутри команды в дерево сессии отбит"
check "$(run Bash '{"command":"X=--dir='"$R"'/a.txt ls"}' | verdict)" "deny" "путь дерева сессии в значении флага отбит"

# Причина доходит до модели: JSON отказа обязан парситься при любой длине команды.
for pad in 20 150 400 1000; do
  cmd="cd $R && git commit -m \\\"fix $(printf 'z%.0s' $(seq "$pad"))\\\""
  out="$(run Bash '{"command":"'"$cmd"'"}')"
  check "$(printf '%s' "$out" | python3 -c 'import json,sys
try:
    json.loads(sys.stdin.read()); print("валиден")
except Exception: print("сломан")')" "валиден" "JSON отказа валиден при команде с кавычками, pad=$pad"
done
out="$(run Bash '{"command":"cd '"$R"' && node -e \"console.log('\''a\t b'\'')\""}')"
check "$(printf '%s' "$out" | verdict)" "deny" "команда с кавычками и табом отбита"
check "$(printf '%s' "$out" | reason | grep -c "$W")" "1" "в причине назван путь дерева трека"

# Вторая цель: дерево каждой законно, различителя «своей» в событии нет - это названо в тексте отказа.
"$H/ledger.py" open PROJ-2 autonomous >/dev/null
W2="$("$H/worktree.py" where PROJ-2)"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | reason | grep -c "$W2")" "0" "дерево второй цели ещё не заведено - в отказе его нет"
"$H/worktree.py" path PROJ-2 >/dev/null 2>&1
check "$(run Write '{"file_path":"'"$W2"'/x.txt"}' | verdict)" "allow" "дерево второй цели заведено - запись в него разрешена"
check "$(run Write '{"file_path":"'"$W"'/x.txt"}' | verdict)" "allow" "дерево первой цели остаётся разрешённым"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | reason | grep -c 'открытой цели')" "1" "отказ говорит о дереве открытой цели, не о «своём»"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | reason | grep -c "$W2")" "1" "отказ называет деревья всех открытых целей"
"$H/ledger.py" close PROJ-2 complete

# CRLF в ledger не должен гасить сторожа целиком.
goal="$CLAUDE_CONFIG_DIR/projects/$(printf '%s' "$R" | sed 's/[^A-Za-z0-9-]/-/g')/ledger/PROJ-1/00-goal.md"
cp "$goal" "$T/goal.bak"; sed -i 's/$/\r/' "$goal"
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "deny" "CRLF в 00-goal.md не снимает сторожа"
cp "$T/goal.bak" "$goal"

# Без python3 движок не работает: гейт run-hook.sh отбивает вызов узла, чужие сессии не задевая.
B="$T/bin"; mkdir -p "$B"
for u in bash sh env sed tr cut grep awk git ls mkdir rm mv head basename dirname cat sort find chmod; do
  x="$(type -P "$u")" && ln -sf "$x" "$B/$u"
done
gate() { ev "$@" | PATH="$B" "$H/run-hook.sh" tree-guard; }
check "$(PATH="$B" command -v python3)" "" "шим прячет python3"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "deny" "без python3: вызов узла отбит"
check "$(gate Write '{"file_path":"'"$W"'/y.txt"}' | verdict)" "deny" "без python3: запись даже в дерево отбита - сверить её нечем"
check "$(gate Bash '{"command":"cd '"$W"' && npm test"}' | verdict)" "deny" "без python3: Bash узла отбит"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' '' | verdict)" "allow" "без python3: главный поток не задет"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' op1 | verdict)" "allow" "без python3: субагент оператора со своим транскриптом не задет"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' 'general-purpose' | verdict)" "deny" "без python3: узел с agentType отбит"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' op1 '' | verdict)" "deny" "без python3: событие без transcript_path отбито"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' 'Explore' op1 "$T/proj/s" | verdict)" "deny" "без python3: transcript_path не на .jsonl отбит"
check "$(gate Write '{"file_path":"'"$R"'/a.txt"}' | reason | grep -c 'python3')" "1" "без python3: причина называет, чего не хватает"
printf '{"cwd":"%s"}' "$R" | PATH="$B" "$H/run-hook.sh" stop-guard >/dev/null 2>&1
check "$?" "0" "без python3: Stop пропускает - иначе ход нечем закончить"
printf '{"source":"startup","cwd":"%s"}' "$R" | PATH="$B" "$H/run-hook.sh" session-start >/dev/null 2>&1
check "$?" "0" "без python3: SessionStart не роняет старт сессии"

# Событие не разобрано: сторож при живой цели отбивает, а не пропускает молча.
check "$(printf 'не json' | "$G" | verdict)" "deny" "битое событие при открытой цели - отказ"
check "$(printf 'не json' | CLAUDE_CONFIG_DIR="$T/empty" "$G" | verdict)" "allow" "битое событие без целей dex-auto - чужой узел не задет"

# Закрытая цель сторожа не держит.
"$H/ledger.py" close PROJ-1 complete
check "$(run Write '{"file_path":"'"$R"'/a.txt"}' | verdict)" "allow" "все цели закрыты - сторож молчит"

# Сессия не в основной копии: сторожится её дерево, а не основная копия (свой worktree) и не .git суперпроекта (подмодуль).
git -C "$R" worktree add -q "$T/own" -b own 2>/dev/null
git init -q "$T/lib"; git -C "$T/lib" -c user.email=t@t -c user.name=t commit -q --allow-empty -m lib
git -C "$R" -c protocol.file.allow=always submodule add -q "$T/lib" lib >/dev/null 2>&1
for s in "свой worktree:$T/own" "подмодуль:$R/lib"; do
  S="${s#*:}"; export DEX_AUTO_CWD="$S" CLAUDE_PROJECT_DIR="$S"
  "$H/ledger.py" open PROJ-3 autonomous >/dev/null
  WS="$("$H/worktree.py" path PROJ-3 2>/dev/null)"
  check "$(HERE="$S" run Write '{"file_path":"'"$WS"'/x.txt"}' | verdict)" "deny" "сессия - ${s%%:*}: узел, стартовавший в её дереве, отбит"
  check "$(HERE="$WS" run Write '{"file_path":"'"$S"'/a.txt"}' | verdict)" "deny" "сессия - ${s%%:*}: запись узла в её дерево отбита"
  check "$(HERE="$WS" run Write '{"file_path":"'"$WS"'/x.txt"}' | verdict)" "allow" "сессия - ${s%%:*}: запись в дерево трека разрешена"
done

echo "---"; [ "$fail" = 0 ] && echo "все $n проверок пройдены" || echo "есть провалы"; exit "$fail"
