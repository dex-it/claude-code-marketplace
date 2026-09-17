#!/usr/bin/env bash
# Регрессия CLI-контракта validate-node-contract.js: код выхода, сводка и режим одного файла.
# tools/test-rules.js судит только строки находок `ERROR [rule]` и код выхода не читает, поэтому ветки,
# у которых исход - код или число находок, фикстурой не держатся: пустой набор носителей давал код 0
# (зелёный прогон на сломанном обходе), документ вместо носителя судился как агент, каталог падал
# стектрейсом. Дерево подставляется через MARKETPLACE_ROOT, сеть не нужна.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validator="$root/tools/validate-node-contract.js"
# Словарь песочницы, а не каталога: правка живого словаря не должна ронять тест CLI.
dictionary="$root/tools/__fixtures__/_base/plugins/skills/dex-skill-node-contract/skills/node-contract/SKILL.md"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

# run <дерево> [аргумент] -> $out (stdout+stderr без цвета), $rc
# Код - статус подстановки: при pipefail это код валидатора, если sed не упал.
run() {
  out=$(MARKETPLACE_ROOT="$1" node "$validator" "${2:-all}" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
  rc=$?
}
# runargs <дерево> <аргументы...> - произвольная строка аргументов.
runargs() {
  local t="$1"; shift
  out=$(MARKETPLACE_ROOT="$t" node "$validator" "$@" 2>&1 | sed 's/\x1b\[[0-9;]*m//g')
  rc=$?
}

tree() { # <имя> -> путь дерева со словарём
  local t="$tmp/$1"
  mkdir -p "$t/plugins/skills/dex-skill-node-contract/skills/node-contract"
  cp "$dictionary" "$t/plugins/skills/dex-skill-node-contract/skills/node-contract/SKILL.md"
  echo "$t"
}

agent() { # <дерево> <строка тела>
  mkdir -p "$1/plugins/specialists/fixture/dex-cli/agents"
  printf -- '---\nname: cli-agent\n---\n%s\n' "$2" > "$1/plugins/specialists/fixture/dex-cli/agents/cli-agent.md"
}

# 1. Словарь есть, носителей нет - сломанный обход или чужой корень, не чистый каталог.
t=$(tree empty)
run "$t"
[ "$rc" -eq 1 ] && grep -q 'No agent or track files found' <<<"$out" \
  && ok "пустой набор носителей -> код 1" || bad "пустой набор носителей: rc=$rc, $out"

# 2. Повтор неверного имени в одной строке - две находки, а не одна.
t=$(tree dup); agent "$t" 'с `diff_scope` и снова `diff_scope`'
run "$t"
n=$(grep -c 'ERROR \[contract-field-spelling\] line 4:' <<<"$out")
[ "$rc" -eq 1 ] && [ "$n" -eq 2 ] && ok "повтор в строке -> 2 находки" || bad "повтор в строке: rc=$rc, находок $n"

# 3. Словарь с CRLF - тот же словарь, а не пропавший.
t=$(tree crlf); agent "$t" 'поле `diff-scope` написано верно'
perl -pi -e 's/\n/\r\n/' "$t/plugins/skills/dex-skill-node-contract/skills/node-contract/SKILL.md"
run "$t"
[ "$rc" -eq 0 ] && ! grep -q 'contract-dictionary-missing' <<<"$out" \
  && ok "словарь с CRLF читается" || bad "словарь с CRLF: rc=$rc, $out"

# 4. Файла словаря нет - находка и честная сводка, не «1 file(s) checked».
t=$(tree nodict); agent "$t" 'ok'
rm "$t/plugins/skills/dex-skill-node-contract/skills/node-contract/SKILL.md"
run "$t"
[ "$rc" -eq 1 ] && grep -q '(file not found)' <<<"$out" && grep -q 'dictionary unreadable, 0 carrier file(s) checked' <<<"$out" \
  && ok "словаря нет -> contract-dictionary-missing, сводка без носителей" || bad "словаря нет: rc=$rc, $out"

# 5. Режим одного файла: только существующий файл-носитель.
t=$(tree single); agent "$t" 'поле `run_status`'
run "$t" "$t/plugins/nope.md"
[ "$rc" -eq 1 ] && grep -q 'File not found' <<<"$out" && ok "один файл: нет файла -> код 1" || bad "нет файла: rc=$rc, $out"
run "$t" "$t/plugins"
[ "$rc" -eq 1 ] && grep -q 'Not a file' <<<"$out" && ! grep -q 'EISDIR' <<<"$out" \
  && ok "один файл: каталог -> сообщение и код 1" || bad "каталог: rc=$rc, $out"
printf 'поле `run_status`\n' > "$t/README.md"
run "$t" "$t/README.md"
[ "$rc" -eq 1 ] && grep -q 'Not a node-contract carrier' <<<"$out" \
  && ok "один файл: не носитель -> отказ" || bad "не носитель: rc=$rc, $out"
run "$t" "$t/plugins/specialists/fixture/dex-cli/agents/cli-agent.md"
[ "$rc" -eq 1 ] && grep -q '1 file(s) checked, 1 error(s)' <<<"$out" \
  && ok "один файл: носитель судится" || bad "носитель: rc=$rc, $out"

# 6. Неизвестный флаг и лишний аргумент - отказ с Usage, а не полный прогон.
t=$(tree args); agent "$t" 'ok'
runargs "$t" --help
[ "$rc" -eq 1 ] && grep -q 'Usage:' <<<"$out" && ! grep -q 'checked' <<<"$out" \
  && ok "неизвестный флаг -> Usage и код 1" || bad "флаг: rc=$rc, $out"
runargs "$t" "$t/plugins/specialists/fixture/dex-cli/agents/cli-agent.md" "$t/nope.md"
[ "$rc" -eq 1 ] && grep -q 'unexpected argument' <<<"$out" \
  && ok "второй позиционный аргумент -> отказ" || bad "два аргумента: rc=$rc, $out"
out=$(MARKETPLACE_ROOT= node "$validator" all 2>&1); rc=$?
[ "$rc" -eq 1 ] && grep -q 'MARKETPLACE_ROOT is set but empty' <<<"$out" \
  && ok "пустой MARKETPLACE_ROOT -> отказ" || bad "пустой корень: rc=$rc, $out"

# 7. Файл .js вне tracks/ - не носитель.
mkdir -p "$t/plugins/misc/dex-x/lib"; printf "const F = { run_status: 1 }\n" > "$t/plugins/misc/dex-x/lib/helper.js"
run "$t" "$t/plugins/misc/dex-x/lib/helper.js"
[ "$rc" -eq 1 ] && grep -q 'Not a node-contract carrier' <<<"$out" \
  && ok ".js вне tracks/ - не носитель" || bad ".js вне tracks: rc=$rc, $out"

# 8. Заголовок словаря с хвостовым пробелом и словарь последним разделом без перевода строки в конце.
t=$(tree tail); agent "$t" 'поле `diff_scope`'
d="$t/plugins/skills/dex-skill-node-contract/skills/node-contract/SKILL.md"
perl -0pi -e 's/## Словарь полей\n/## Словарь полей  \n/; s/\n## Соседняя таблица.*//s; s/\n+\z//' "$d"
run "$t"
[ "$rc" -eq 1 ] && grep -q '"diff_scope" (тело агента)' <<<"$out" && ! grep -q 'contract-dictionary-missing' <<<"$out" \
  && ok "хвостовой пробел заголовка и словарь в конце файла" || bad "хвост словаря: rc=$rc, $out"
printf -- '---\nname: cli-agent\n---\nполе `red_run`\n' > "$t/plugins/specialists/fixture/dex-cli/agents/cli-agent.md"
perl -0pi -e 's/\| `red-run` \|[^\n]*\n//' "$d"
printf '\n| `red-run` | последняя строка файла | - |' >> "$d"
run "$t"
[ "$rc" -eq 1 ] && grep -q '"red_run" (тело агента)' <<<"$out" \
  && ok "последняя строка словаря без перевода строки читается" || bad "последняя строка: rc=$rc, $out"

# 9. Заголовок `## ` внутри fenced-блока в разделе словаря - не конец раздела.
t=$(tree fence); agent "$t" 'поле `diff_scope`'
d="$t/plugins/skills/dex-skill-node-contract/skills/node-contract/SKILL.md"
perl -0pi -e 's/(\| `diff-scope` \|)/```md\n## Пример раздела\n```\n$1/' "$d"
run "$t"
[ "$rc" -eq 1 ] && grep -q '"diff_scope" (тело агента)' <<<"$out" \
  && ok "fenced-блок с ## не обрезает словарь" || bad "fence в словаре: rc=$rc, $out"

[ "$fail" -eq 0 ] && echo "node-contract-cli.test.sh: все проверки прошли" || echo "node-contract-cli.test.sh: есть провалы"
exit "$fail"
