#!/usr/bin/env bash
# Раннеры замеров, вызывающие `claude -p`, не пускают в прогон среду оператора (память, настройки, плагины, MCP): метод -
# tests/README.md, «Среда прогона раннеров `claude -p`». Платных прогонов нет: `claude` подменён заглушкой, она пишет свои
# аргументы. Две стороны:
#  1. статическая - каждый файл tests/ и tools/, запускающий `claude`, несёт `--restricted` либо изоляцию через
#     `--setting-sources` (новый раннер без того и другого красит тест);
#  2. динамическая - раннеры оркестрации и волны передают `--setting-sources project --strict-mcp-config`, а `triage.mjs`
#     (инструментов нет вовсе) - `--restricted --strict-mcp-config`; `OPERATOR_ENV=1` снимает изоляцию кодовых раннеров.
# Раннеры trap-наборов и `auto-nodes/run.sh` здесь не гоняются: первые закрыты статической стороной (все с `--restricted`),
# второй - живым путём в auto-nodes-run.test.sh.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; [ -n "${2:-}" ] && echo "$2" | sed 's/^/     | /'; fail=1; }

# 1. статика
cd "$root"
callers=$(grep -rlE "spawn(Sync)?\('claude'|\['claude', '-p'|(^|[ (\"])claude -p ['\"\$-]" tests tools \
  --include='*.sh' --include='*.mjs' --include='*.js' --include='*.py' | grep -v 'tests/tools/' | sort)
[ -n "$callers" ] && ok "найдено раннеров claude: $(echo "$callers" | wc -l | tr -d ' ')" || bad "раннеры claude не найдены - шаблон поиска мёртв"
unisolated=""
for f in $callers; do
  grep -q -e '--restricted' -e '--setting-sources' -e 'ISOLATION' "$f" || unisolated="$unisolated $f"
done
[ -z "$unisolated" ] && ok "каждый раннер несёт --restricted либо --setting-sources" || bad "раннеры без изоляции:$unisolated"

# 2. динамика: заглушка пишет аргументы вызова в $STUB_LOG (по вызову - блок через строку ---)
mkdir -p "$tmp/bin"
cat > "$tmp/bin/claude" <<'STUB'
#!/bin/sh
{ printf '%s\n' "$@"; echo '---'; } >> "$STUB_LOG"
echo '{}'
exit 0
STUB
chmod +x "$tmp/bin/claude"

# has <метка> <лог> <аргумент>... : все аргументы стоят отдельными строками лога
has_all() { local log=$1; shift; local a; for a in "$@"; do grep -qxF -- "$a" "$log" || return 1; done; }
none_of() { local log=$1; shift; local a; for a in "$@"; do ! grep -qxF -- "$a" "$log" || return 1; done; }
runit() { # runit <лог> <команда>... (OPERATOR_ENV из окружения вызова)
  local log=$1; shift; : > "$log"
  PATH="$tmp/bin:$PATH" STUB_LOG="$log" "$@" >"$tmp/out.txt" 2>&1
}

check_code_runner() { # <метка> <лог> <команда>...
  local label=$1 log=$2; shift 2
  runit "$log" "$@"
  if [ ! -s "$log" ]; then bad "$label: claude не вызван" "$(tail -5 "$tmp/out.txt")"; return; fi
  has_all "$log" --setting-sources project --strict-mcp-config && none_of "$log" --restricted \
    && ok "$label: изоляция по умолчанию (--setting-sources project --strict-mcp-config)" || bad "$label: изоляции по умолчанию нет" "$(cat "$log" | head -40)"
  OPERATOR_ENV=1 runit "$log" "$@"
  none_of "$log" --setting-sources --strict-mcp-config && ok "$label: OPERATOR_ENV=1 снимает изоляцию" || bad "$label: OPERATOR_ENV=1 не снял изоляцию"
}

O="$root/tests/orchestration"
check_code_runner "modes/run.mjs" "$tmp/l1" node "$O/modes/run.mjs" "$tmp/d-modes" --set exam
check_code_runner "dispatch/run.mjs" "$tmp/l2" node "$O/dispatch/run.mjs" "$tmp/d-disp" --arm none
check_code_runner "skills/run.mjs" "$tmp/l3" node "$O/skills/run.mjs" "$tmp/d-skills" --role exec --set pick
node "$O/harness.mjs" tree "$tmp/d-h" O-01 >/dev/null 2>&1
check_code_runner "harness.mjs case" "$tmp/l4" node "$O/harness.mjs" case "$tmp/d-h" O-01 --model haiku --effort low
mkdir -p "$tmp/repo"
check_code_runner "wave/single.py" "$tmp/l5" python3 -I "$O/wave/single.py" "$tmp/repo" --out "$tmp/single.json"
printf 'задача\n' > "$tmp/TASK.md"
check_code_runner "wave/wave.py plan" "$tmp/l6" python3 -I "$O/wave/wave.py" plan "$tmp/repo" --task "$tmp/TASK.md" --out "$tmp/plan.json"

# triage: инструментов нет вовсе, значит --restricted годится и снимать его нечем
runit "$tmp/l7" node "$O/triage.mjs" run "$tmp/d-triage" --runs 1
has_all "$tmp/l7" --restricted --strict-mcp-config && ok "triage.mjs: --restricted --strict-mcp-config" || bad "triage.mjs: --restricted --strict-mcp-config нет" "$(head -30 "$tmp/l7")"

exit $fail
