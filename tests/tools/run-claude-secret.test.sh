#!/usr/bin/env bash
# Регрессия разбора .env в run-claude: значение $(pass show <путь>) идёт вызовом pass напрямую (берётся
# первая строка записи), любое другое $(...) - литералом и ничего не исполняется. Раньше значение шло
# через eval, и строка TOKEN=$(touch ...) из скопированного .env исполнялась молча при первом запуске.
# Исполнить код может и имя переменной (BASH_ENV=$(...)): имя проходит фильтр, опасные не экспортируются.
# Функции берутся из скриптов как есть, а лаунчер и регистратор гоняются целиком на заглушках pass и claude
# в PATH; сеть и менеджер паролей не нужны. Обе ps1-пары сверяются как текст (pwsh не нужен).
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# extract <файл> <функция>: текст от заголовка функции до первой "}" в начале строки
extract()    { sed -n "/^$2() {/,/^}/p" "$root/run-claude/$1"; }
extract_ps() { sed -n "/^function $2/,/^}/p" "$root/run-claude/$1"; }

mkdir -p "$tmp/bin"
cat > "$tmp/bin/pass" <<'STUB'
#!/usr/bin/env bash
[ "$1" = show ] || exit 2
[ "$2" = broken ] && { echo "pass: no such entry" >&2; exit 1; }
printf 'secret-of:%s\nlogin: alice\nurl: https://example.invalid\n' "$2"
STUB
cat > "$tmp/bin/claude" <<'STUB'
#!/usr/bin/env bash
env > "${CLAUDE_STUB_ENV:?}"
STUB
chmod +x "$tmp/bin/pass" "$tmp/bin/claude"

# --- одинаковость пар: правка одной без другой краснеет ---
for fn in trim_env_value env_key_allowed resolve_env_secret; do
  [ -n "$(extract run-claude.sh $fn)" ] || { bad "run-claude.sh: $fn не найдена"; exit 1; }
  [ "$(extract run-claude.sh $fn)" = "$(extract register-http-mcp.sh $fn)" ] \
    && ok "sh: $fn одинакова в лаунчере и регистраторе" || bad "sh: $fn разошлась в лаунчере и регистраторе"
done
for fn in Format-EnvValue Test-EnvKey Resolve-EnvSecret; do
  [ -n "$(extract_ps run-claude.ps1 $fn)" ] || { bad "run-claude.ps1: $fn не найдена"; exit 1; }
  [ "$(extract_ps run-claude.ps1 $fn)" = "$(extract_ps register-http-mcp.ps1 $fn)" ] \
    && ok "ps1: $fn одинакова в лаунчере и регистраторе" || bad "ps1: $fn разошлась в лаунчере и регистраторе"
done

funcs="$(extract run-claude.sh trim_env_value)"$'\n'"$(extract run-claude.sh env_key_allowed)"$'\n'"$(extract run-claude.sh resolve_env_secret)"

# run <значение из .env> -> stdout; значение проходит тот же срез, что и в скриптах; stderr в $tmp/err
run() {
  rm -f "$tmp/flag" "$tmp/err"
  ( cd "$tmp" && PATH="$tmp/bin:$PATH" bash -c "$funcs"$'\n''resolve_env_secret KEY "$(trim_env_value "$1")"' _ "$1" 2>"$tmp/err" )
}

check() { # <описание> <значение> <ожидаемый stdout> <stderr: yes - предупреждение, pass - ошибка pass, no - пусто>
  local out; out=$(run "$2")
  [ "$out" = "$3" ] || { bad "$1 - получено «${out}», ожидалось «${3}»"; return; }
  [ ! -e "$tmp/flag" ] || { bad "$1 - исполнилась посторонняя команда"; return; }
  case "$4" in
    yes) grep -q 'ПРЕДУПРЕЖДЕНИЕ: KEY' "$tmp/err" || { bad "$1 - нет предупреждения"; return; } ;;
    pass) grep -q 'no such entry' "$tmp/err" || { bad "$1 - ошибка pass не дошла до пользователя"; return; } ;;
    *) [ ! -s "$tmp/err" ] || { bad "$1 - лишний вывод в stderr"; return; } ;;
  esac
  ok "$1"
}

check "обычное значение без изменений" 'abc123' 'abc123' no
check "обрамляющие кавычки и пробелы по краям снимаются" '  "abc 123"  ' 'abc 123' no
check "pass show <путь> -> только первая строка записи" '$(pass show mdm/elastic-key_1.v2)' 'secret-of:mdm/elastic-key_1.v2' no
check "pass show в кавычках целиком -> тоже разрешается" '"$(pass show team/jira)"' 'secret-of:team/jira' no
check "pass завершился ошибкой -> пустое значение, ошибка pass видна" '$(pass show broken)' '' pass
check "цепочка через ; не исполняется" '$(pass show x; touch flag)' '$(pass show x; touch flag)' yes
check "чужая команда не исполняется" '$(touch flag)' '$(touch flag)' yes
check "подвыражение внутри значения не исполняется" 'pre$(touch flag)post' 'pre$(touch flag)post' yes
check "путь с ведущим дефисом (опция pass) не принимается" '$(pass show -c)' '$(pass show -c)' yes
check "путь с подстановкой не принимается" '$(pass show $(touch flag))' '$(pass show $(touch flag))' yes
check "пробел в пути не принимается" '$(pass show a b)' '$(pass show a b)' yes
# Расхождение лаунчера и регистратора, на которое указал ревьюер: кавычки внутри и двойной пробел - литерал везде
check "кавычки вокруг пути - литерал" '$(pass show "team/jira")' '$(pass show "team/jira")' yes
check "двойной пробел после pass - литерал" '$(pass  show team/jira)' '$(pass  show team/jira)' yes

# --- фильтр имён ---
keycheck() { # <описание> <имя> <allow|deny>
  local rc=0; ( bash -c "$funcs"$'\n''env_key_allowed "$1"' _ "$2" ) >/dev/null 2>&1 || rc=$?
  if [ "$3" = allow ]; then [ "$rc" -eq 0 ] && ok "$1" || bad "$1 - имя отброшено"
  else [ "$rc" -ne 0 ] && ok "$1" || bad "$1 - имя пропущено"; fi
}
keycheck "обычное имя проходит" JIRA_MCP_TOKEN allow
keycheck "имя с подчёркиванием и цифрами проходит" _my_Var_2 allow
keycheck "GIT_TOKEN-подобное имя вне списка проходит" GITLAB_TOKEN allow
keycheck "имя с подвыражением отбрасывается" 'BASH_ENV$(touch flag)' deny
keycheck "имя с цифры отбрасывается" 1ABC deny
keycheck "имя с дефисом отбрасывается" A-B deny
for k in BASH_ENV ENV PS4 PROMPT_COMMAND SHELLOPTS BASHOPTS PATH NODE_OPTIONS LD_PRELOAD LD_LIBRARY_PATH DYLD_INSERT_LIBRARIES \
         GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0 GIT_SSH GIT_SSH_COMMAND GIT_PAGER GIT_EXTERNAL_DIFF GIT_ASKPASS GIT_EDITOR; do
  keycheck "$k отбрасывается" "$k" deny
done

# --- лаунчер и регистратор целиком: .env с опасными именами ---
cat > "$tmp/env" <<ENVEOF
BASH_ENV=\$(touch $tmp/flag)
GIT_CONFIG_COUNT=1
GIT_CONFIG_KEY_0=core.fsmonitor
GIT_CONFIG_VALUE_0=touch $tmp/flag
LD_PRELOAD=/tmp/evil.so
PATH=/nonexistent
GOOD_TOKEN=\$(pass show team/jira)
QUOTED_TOKEN="\$(pass show team/quoted)"
SPACED=\$(pass  show x)
JIRA_MCP_URL=https://example.invalid/mcp
JIRA_MCP_TOKEN=\$(pass show team/jira)
ENVEOF

# лаунчер: claude-заглушка пишет окружение, с которым её запустили
mkdir -p "$tmp/proj/run-claude"
cp "$root/run-claude/run-claude.sh" "$tmp/proj/run-claude/"
cp "$tmp/env" "$tmp/proj/run-claude/.env"
rm -f "$tmp/flag" "$tmp/claude-env"
( cd "$tmp/proj/run-claude" && PATH="$tmp/bin:$PATH" CLAUDE_STUB_ENV="$tmp/claude-env" bash ./run-claude.sh </dev/null >/dev/null 2>"$tmp/err" )
[ -s "$tmp/claude-env" ] || bad "лаунчер: claude не запущен ($(head -c 200 "$tmp/err"))"
[ ! -e "$tmp/flag" ] && ok "лаунчер: код из имени BASH_ENV / GIT_CONFIG_* не исполнился" || bad "лаунчер: исполнился код из имени переменной"
if grep -qE '^(BASH_ENV|GIT_CONFIG_COUNT|GIT_CONFIG_KEY_0|GIT_CONFIG_VALUE_0|LD_PRELOAD)=' "$tmp/claude-env" \
   || grep -q '^PATH=/nonexistent' "$tmp/claude-env"; then bad "лаунчер: опасное имя попало в окружение claude"; else ok "лаунчер: опасные имена не экспортируются"; fi
grep -q 'ПРЕДУПРЕЖДЕНИЕ: BASH_ENV' "$tmp/err" && ok "лаунчер: об отброшенном имени предупреждено" || bad "лаунчер: нет предупреждения об отброшенном имени"
grep -qx 'GOOD_TOKEN=secret-of:team/jira' "$tmp/claude-env" && ok "лаунчер: допустимый ключ с pass show проходит, взята первая строка" || bad "лаунчер: GOOD_TOKEN не разрешён или не первая строка"
grep -qx 'QUOTED_TOKEN=secret-of:team/quoted' "$tmp/claude-env" && ok "лаунчер: значение в кавычках разбирается как у регистратора" || bad "лаунчер: QUOTED_TOKEN"
grep -qxF 'SPACED=$(pass  show x)' "$tmp/claude-env" && ok "лаунчер: двойной пробел остаётся литералом, xargs не схлопывает" || bad "лаунчер: SPACED разобран иначе, чем у регистратора"

# регистратор: dry-run печатает URL, а он взят через pass show
cp "$root/run-claude/register-http-mcp.sh" "$tmp/proj/run-claude/"
sed '/^JIRA_MCP_/d' "$tmp/env" > "$tmp/env2"
printf 'JIRA_MCP_URL=$(pass show team/jira)\nJIRA_MCP_TOKEN=t\n' >> "$tmp/env2"
rm -f "$tmp/flag"
out=$(cd "$tmp/proj/run-claude" && PATH="$tmp/bin:$PATH" bash ./register-http-mcp.sh --env-file "$tmp/env2" --dry-run 2>"$tmp/err")
[ ! -e "$tmp/flag" ] && ok "регистратор: код из имени BASH_ENV / GIT_CONFIG_* не исполнился" || bad "регистратор: исполнился код из имени переменной"
case "$out" in *"secret-of:team/jira"*) ok "регистратор: допустимый ключ с pass show проходит, взята первая строка" ;; *) bad "регистратор: pass show не разрешён ($out)" ;; esac
case "$out" in *"login: alice"*) bad "регистратор: взята не только первая строка" ;; *) ok "регистратор: строки записи после первой не попали в значение" ;; esac
grep -q 'ПРЕДУПРЕЖДЕНИЕ: BASH_ENV' "$tmp/err" && ok "регистратор: об отброшенном имени предупреждено" || bad "регистратор: нет предупреждения об отброшенном имени"

exit "$fail"
