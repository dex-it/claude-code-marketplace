#!/usr/bin/env bash
# sync-plugins.sh и его PowerShell-зеркало sync-plugins.ps1: ребро "поставлен, а в каталоге его больше нет" (остаток #198), и что три прежних
# ребра (недостающий skill, недостающий исполнитель, --fix) не поплыли после перевода накопителей с
# ассоциативных массивов на строки (стоковый bash 3.2 macOS их не знает). Скрипт идёт в копии дерева
# с фикстурным каталогом; `claude` подменён заглушкой, она отдаёт список из $STUB_LIST и пишет вызовы.
# Сценарии одни на оба скрипта: тексты вывода у .ps1 те же, что у .sh. Без `pwsh` вариант .ps1 не идёт и об этом
# сказано строкой `skip`; REQUIRE_PWSH=1 (CI) превращает отсутствие `pwsh` в провал, а не в тихий пропуск.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

fail=0
ok()  { echo "ok   $1"; }
bad() { echo "FAIL $1"; echo "$2" | sed 's/^/     | /'; fail=1; }

# дерево: install-bundle/sync-plugins.sh, каталог из четырёх плагинов, агент dex-coder грузит skill
# dex-skill-known (в каталоге) и зовёт исполнителя dex-runner (в каталоге)
tree="$tmp/clone"
mkdir -p "$tree/install-bundle" "$tree/.claude-plugin" "$tree/plugins/specialists/grp/dex-coder/agents"
cp "$root/install-bundle/sync-plugins.sh" "$root/install-bundle/sync-plugins.ps1" "$tree/install-bundle/"
cat > "$tree/.claude-plugin/marketplace.json" <<'JSON'
{"name":"dex-claude-marketplace","plugins":[
  {"name":"dex-coder"},{"name":"dex-runner"},{"name":"dex-skill-known"},{"name":"dex-skill-new-name"}]}
JSON
printf -- '---\nname: coder\n---\nLoad `dex-skill-known:rules`, then hand over to `dex-runner:run`.\n' \
  > "$tree/plugins/specialists/grp/dex-coder/agents/coder.md"

mkdir -p "$tmp/bin"
cat > "$tmp/bin/claude" <<'STUB'
#!/bin/bash
if [ "$1 $2" = "plugins list" ]; then cat "$STUB_LIST"; exit 0; fi
echo "$*" >> "$STUB_LOG"
exit 0
STUB
chmod +x "$tmp/bin/claude"

# list <имя>... -> файл со списком поставленных плагинов нашего каталога
list() {
  local f="$tmp/list.$RANDOM.json" first=1 n
  printf '[' > "$f"
  for n in "$@"; do
    [ $first = 1 ] || printf ',' >> "$f"; first=0
    printf '{"id":"%s@dex-claude-marketplace","enabled":true}' "$n" >> "$f"
  done
  printf ']' >> "$f"
  echo "$f"
}

# run <интерпретатор> <список> [аргументы] -> вывод без цветов; код в $rc, вызовы claude в $STUB_LOG.
# Интерпретатор `pwsh` запускает .ps1, аргумент --fix переводится в -Fix.
run() {
  local sh="$1" lst="$2"; shift 2
  : > "$tmp/calls.log"
  if [ "$sh" = pwsh ]; then
    local args=() a
    for a in "$@"; do [ "$a" = --fix ] && args+=(-Fix) || args+=("$a"); done
    out=$(PATH="$tmp/bin:$PATH" STUB_LIST="$lst" STUB_LOG="$tmp/calls.log" pwsh -NoProfile -NonInteractive -File "$tree/install-bundle/sync-plugins.ps1" ${args[@]+"${args[@]}"} 2>&1 \
      | sed $'s/\x1b\\[[0-9;]*m//g'); rc=$?
  else
    out=$(PATH="$tmp/bin:$PATH" STUB_LIST="$lst" STUB_LOG="$tmp/calls.log" "$sh" "$tree/install-bundle/sync-plugins.sh" "$@" 2>&1 \
      | sed $'s/\x1b\\[[0-9;]*m//g'); rc=$?
  fi
}
has()  { printf '%s' "$out" | grep -qF -- "$1"; }

shells="bash"
[ -x /bin/bash ] && [ "$(command -v bash)" != /bin/bash ] && shells="bash /bin/bash"
if command -v pwsh >/dev/null 2>&1; then shells="$shells pwsh"
elif [ "${REQUIRE_PWSH:-}" = 1 ]; then bad "[pwsh] pwsh нужен (REQUIRE_PWSH=1), а его нет" "команда pwsh не найдена в PATH"
else echo "skip [pwsh] pwsh не найден - вариант sync-plugins.ps1 не прогнан (REQUIRE_PWSH=1 делает это провалом)"; fi

# Перечень by-stack префиксов у .ps1 тот же, что у .sh: расхождение молча меняет, какие skills считаются недостающими.
# Проверка статическая, pwsh не нужен.
sh_stack=$(sed -n 's/^BY_STACK_PREFIXES="\(.*\)"$/\1/p' "$root/install-bundle/sync-plugins.sh")
ps_stack=$(sed -n 's/^\$ByStackPrefixes = "\(.*\)"\.Split(" ")$/\1/p' "$root/install-bundle/sync-plugins.ps1")
if [ -n "$sh_stack" ] && [ "$sh_stack" = "$ps_stack" ]; then ok "by-stack префиксы .ps1 равны .sh"
else bad "by-stack префиксы .ps1 равны .sh" "sh: [$sh_stack]
ps1: [$ps_stack]"; fi

for sh in $shells; do
  tag="[$sh]"

  # 1. два снятых имени (одно из них - прежнее имя переименованного) названы вместе с командой снятия
  run "$sh" "$(list dex-coder dex-runner dex-skill-known dex-skill-gone dex-skill-old-name)"
  if [ $rc -eq 0 ] && has "no longer in the catalogue" && has "dex-skill-gone" && has "dex-skill-old-name" \
     && has "claude plugins uninstall dex-skill-gone@dex-claude-marketplace" \
     && has "Renamed and removed plugins"; then
    ok "$tag снятые плагины названы с командой снятия, код 0"
  else bad "$tag снятые плагины названы с командой снятия, код 0 (rc=$rc)" "$out"; fi

  # 2. живые имена в ребро не попадают, счётчик равен числу снятых
  if has "no longer in the catalogue (removed or renamed upstream): 2" && ! has "    dex-coder" && ! has "    dex-skill-known"; then
    ok "$tag живые плагины не названы снятыми, счёт верен"
  else bad "$tag живые плагины не названы снятыми, счёт верен" "$out"; fi

  # 3. всё живое: ребра нет, итог - "no drift"
  run "$sh" "$(list dex-coder dex-runner dex-skill-known)"
  if [ $rc -eq 0 ] && ! has "no longer in the catalogue" && has "no drift"; then
    ok "$tag каталог покрывает установленное: ребра нет, no drift"
  else bad "$tag каталог покрывает установленное: ребра нет, no drift (rc=$rc)" "$out"; fi

  # 4. снятое имя не позволяет написать "no drift", даже когда skills и исполнители замкнуты
  run "$sh" "$(list dex-coder dex-runner dex-skill-known dex-skill-gone)"
  if ! has "no drift" && has "orphaned plugins above are not"; then
    ok "$tag при снятом имени итог не 'no drift'"
  else bad "$tag при снятом имени итог не 'no drift'" "$out"; fi

  # 5. недостающий skill и исполнитель по-прежнему названы вместе с тем, кто их требует
  run "$sh" "$(list dex-coder)"
  if has "Missing skills" && has "dex-skill-known" && has "needed by: dex-coder" \
     && has "Missing executors" && has "dex-runner" && has "named by: dex-coder" \
     && has "claude plugins install dex-runner@dex-claude-marketplace"; then
    ok "$tag недостающие skill и исполнитель названы, требующий назван"
  else bad "$tag недостающие skill и исполнитель названы, требующий назван (rc=$rc)" "$out"; fi

  # 6. --fix ставит недостающий skill и ничего не снимает
  run "$sh" "$(list dex-coder dex-runner dex-skill-gone)" --fix
  if [ $rc -eq 0 ] && grep -qx 'plugins install dex-skill-known@dex-claude-marketplace' "$tmp/calls.log" \
     && ! grep -q uninstall "$tmp/calls.log" && has "dex-skill-gone"; then
    ok "$tag --fix ставит недостающий skill и не снимает снятое"
  else bad "$tag --fix ставит недостающий skill и не снимает снятое (rc=$rc)" "$out
$(cat "$tmp/calls.log")"; fi

  # 7. отключённый плагин не грузится, ребро его не называет
  printf '[{"id":"dex-skill-off@dex-claude-marketplace","enabled":false},{"id":"dex-skill-known@dex-claude-marketplace"}]' > "$tmp/off.json"
  run "$sh" "$tmp/off.json"
  if ! has "dex-skill-off"; then ok "$tag отключённый снятый плагин не докладывается"
  else bad "$tag отключённый снятый плагин не докладывается" "$out"; fi
done

exit $fail
