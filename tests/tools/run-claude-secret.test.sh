#!/usr/bin/env bash
# Регрессия подстановки секрета из .env в run-claude: значение $(pass show <путь>) идёт вызовом pass
# напрямую, любое другое $(...) - литералом и ничего не исполняет. Раньше значение шло через eval,
# и строка TOKEN=$(touch ...) из скопированного .env исполнялась молча при первом запуске.
# Функция берётся из скриптов как есть; pass подменён заглушкой в PATH, сеть и менеджер паролей не нужны.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

extract() { sed -n '/^resolve_env_secret() {/,/^}/p' "$root/run-claude/$1"; }

mkdir -p "$tmp/bin"
cat > "$tmp/bin/pass" <<'STUB'
#!/usr/bin/env bash
[ "$1" = show ] || exit 2
[ "$2" = broken ] && { echo "pass: no such entry" >&2; exit 1; }
printf 'secret-of:%s\n\n' "$2"
STUB
chmod +x "$tmp/bin/pass"

[ -n "$(extract run-claude.sh)" ] || { bad "run-claude.sh: resolve_env_secret не найдена"; exit 1; }
[ "$(extract run-claude.sh)" = "$(extract register-http-mcp.sh)" ] \
  && ok "лаунчер и регистратор несут одну и ту же функцию" || bad "функции лаунчера и регистратора разошлись"

# run <значение> -> stdout; stderr в $tmp/err, маркер исполнения - $tmp/flag
run() {
  rm -f "$tmp/flag" "$tmp/err"
  ( cd "$tmp" && PATH="$tmp/bin:$PATH" bash -c "$(extract run-claude.sh)"$'\n''resolve_env_secret KEY "$1"' _ "$1" 2>"$tmp/err" )
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
check "pass show <путь> -> вывод pass без хвостовых переводов строки" '$(pass show mdm/elastic-key_1.v2)' 'secret-of:mdm/elastic-key_1.v2' no
check "pass завершился ошибкой -> пустое значение, ошибка pass видна" '$(pass show broken)' '' pass
check "цепочка через ; не исполняется" '$(pass show x; touch flag)' '$(pass show x; touch flag)' yes
check "чужая команда не исполняется" '$(touch flag)' '$(touch flag)' yes
check "подвыражение внутри значения не исполняется" 'pre$(touch flag)post' 'pre$(touch flag)post' yes
check "путь с ведущим дефисом (опция pass) не принимается" '$(pass show -c)' '$(pass show -c)' yes
check "путь с подстановкой не принимается" '$(pass show $(touch flag))' '$(pass show $(touch flag))' yes
check "пробел в пути не принимается" '$(pass show a b)' '$(pass show a b)' yes

exit "$fail"
