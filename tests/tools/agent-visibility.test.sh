#!/usr/bin/env bash
# Регрессия построения кейсов пробы видимости (`run-activation.js --agents`).
# Предмет - сам перечень кейсов, а не исход прогона: кейс, которого не
# построилось, ошибкой не выглядит нигде, и прогон при этом зелёный. Так проба
# и была слепа к подкаталогу `agents/`: обход не рекурсивный убирал разом и
# кейс, и ожидание. Гейт бесплатный - `--list-cases` не ходит в сеть, дерево
# подставляется через MARKETPLACE_ROOT.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

mk() { # <путь плагина от plugins/> <имя в манифесте> <путь под agents/> <значение name:>
  local p="$tmp/plugins/$1"
  mkdir -p "$p/.claude-plugin" "$p/agents/$(dirname "$3")"
  printf '{"name":"%s","version":"1.0.0"}\n' "$2" > "$p/.claude-plugin/plugin.json"
  printf -- '---\nname: %s\ndescription: фикстура пробы\ntools: Read\nmodel: sonnet\n---\n\n# Fixture\n' \
    "$4" > "$p/agents/$3"
}
mk specialists/product/dex-flat   dex-flat     flat-agent.md         flat-agent
mk specialists/product/dex-nested dex-nested   nested/deep-agent.md  deep-agent
mk specialists/product/dex-quoted dex-quoted   quoted-agent.md       '"quoted-agent"'
mk ai-sdlc/dex-outside            dex-outside  outside-agent.md      outside-agent
mk specialists/product/renamed    dex-renamed  renamed-agent.md      renamed-agent

ids=$(MARKETPLACE_ROOT="$tmp" node "$root/tools/run-activation.js" --agents --list-cases 2>/dev/null)
rc=$?

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1: $2"; fail=1; }

[ $rc -eq 0 ] || bad "--list-cases отработал" "код возврата $rc"

has() { printf '%s' "$ids" | grep -qF "\"expect\": \"$1\""; }

# 1. Плоский файл - базовый случай, без него проба не проверяет ничего.
if has 'dex-flat:flat-agent'; then ok "плоский агент даёт кейс"
else bad "плоский агент даёт кейс" "ожидания dex-flat:flat-agent нет"; fi

# 2. Подкаталог. Ожидание - каноничная форма: рантайм поставит трёхсегментное
#    имя, и провал кейса это и есть находка. Нерекурсивный обход даёт здесь ноль.
if has 'dex-nested:deep-agent'; then ok "агент из подкаталога даёт кейс"
else bad "агент из подкаталога даёт кейс" "обход не дошёл до agents/nested/"; fi

# 3. Кавычки в YAML. Регулярка отдавала имя вместе с ними, и кейс падал ложно.
if has 'dex-quoted:quoted-agent'; then ok "имя в кавычках снято"
else bad "имя в кавычках снято" "ожидание собралось с кавычками"; fi

# 4. Плагин вне `plugins/specialists/`. Обход по одной ветке дерева оставлял
#    такого агента без кейса вовсе - слепота того же рода, что подкаталог.
if has 'dex-outside:outside-agent'; then ok "агент вне specialists даёт кейс"
else bad "агент вне specialists даёт кейс" "обход не вышел за plugins/specialists/"; fi

# 5. Имя каталога не равно имени манифеста. Рантайм адресует по манифесту,
#    и ключ по каталогу собрал бы ожидание, которого рантайм не отдаст.
if has 'dex-renamed:renamed-agent'; then ok "имя плагина берётся из манифеста"
else bad "имя плагина берётся из манифеста" "ожидание собрано по имени каталога"; fi

# 6. Перечень построен ровно из дерева песочницы, без примеси живого каталога.
n=$(printf '%s' "$ids" | grep -c '"kind": "agent"')
if [ "$n" = "5" ]; then ok "кейсов ровно по дереву песочницы ($n)"
else bad "кейсов ровно по дереву песочницы" "получено $n вместо 5"; fi

[ $fail -eq 0 ] && echo "все проверки пройдены" || echo "есть провалы"
exit $fail
