#!/usr/bin/env bash
# Регрессия адреса auto-ledger: движок кладёт файл в auto-ledger/ папки сессии
# (P-auto-ledger в SKILL.md движка), хук берёт ту же папку из transcript_path со
# stdin. Носителей у адреса три - текст движка, код хука и README хука, - и
# разъезд деградирует тихо: хук просто молчит, отличить от «ledger закрыт»
# нечем. Проверки 1-6 пиннят поведение хука, 7 - литерал адреса в прозе обоих
# текстовых носителей: без неё правка прозы остаётся зелёной.
set -uo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/plugins/ai-sdlc/dex-sdlc-resume/hooks/scripts/resume-reminder.sh"
command -v jq >/dev/null || { echo "SKIP: jq не установлен - хук отключается сам"; exit 0; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
export CLAUDE_CONFIG_DIR="$tmp/config"
proj="$CLAUDE_CONFIG_DIR/projects/-tmp-work"
sid_a="aaaaaaaa-0000-0000-0000-000000000001"
sid_b="bbbbbbbb-0000-0000-0000-000000000002"
mkdir -p "$proj"
: > "$proj/$sid_a.jsonl"; : > "$proj/$sid_b.jsonl"

put_ledger() { # <каталог-владелец> <имя> <статус>
  mkdir -p "$1/auto-ledger"
  printf '# %s\nСтатус: %s\n' "$2" "$3" > "$1/auto-ledger/$2.md"
  printf '%s' "$1/auto-ledger/$2.md"
}
run() { # <session_id> <source>
  printf '{"transcript_path":"%s","cwd":"/tmp/work","source":"%s"}' "$proj/$1.jsonl" "$2" | bash "$script"
}
run_no_transcript() { printf '{"cwd":"/tmp/work","source":"%s"}' "$1" | bash "$script"; }

fail=0
check() { if printf '%s' "$3" | grep -qF "$2"; then echo "ok   $1"; else echo "FAIL $1: не найдено '$2'"; fail=1; fi; }
check_no() { if printf '%s' "$3" | grep -qF "$2"; then echo "FAIL $1: найдено лишнее '$2'"; fail=1; else echo "ok   $1"; fi; }

# 1. Папка сессии берётся из transcript_path - ledger найден.
p=$(put_ledger "$proj/$sid_a" GOAL-A открыт)
check "ledger папки сессии" "$p" "$(run "$sid_a" compact)"

# 2. Соседняя сессия того же проекта своего ledger не отдаёт.
put_ledger "$proj/$sid_b" GOAL-B открыт >/dev/null
out=$(run "$sid_a" resume)
check_no "изоляция сессий" "GOAL-B.md" "$out"
check "своя цель на resume" "GOAL-A.md" "$out"

# 3. Папка проекта - запасная дверь: читается, только когда в папке сессии пусто.
p_proj=$(put_ledger "$proj" GOAL-FALLBACK открыт)
check_no "папка сессии перебивает запасную" "GOAL-FALLBACK.md" "$(run "$sid_a" compact)"
rm -rf "$proj/$sid_a/auto-ledger"
check "запасная дверь при пустой папке сессии" "$p_proj" "$(run "$sid_a" compact)"
check "запасная дверь без transcript_path" "$p_proj" "$(run_no_transcript compact)"

# 4. Несколько открытых целей в одной сессии - названы все.
put_ledger "$proj/$sid_b" GOAL-B2 открыт >/dev/null
out=$(run "$sid_b" compact)
check "несколько кандидатов: первый" "GOAL-B.md" "$out"
check "несколько кандидатов: второй" "GOAL-B2.md" "$out"

# 5. Закрытый ledger напоминания не поднимает.
rm -rf "$proj/auto-ledger"
put_ledger "$proj/$sid_a" GOAL-A закрыт >/dev/null
[ -z "$(run "$sid_a" compact)" ] && echo "ok   закрытый ledger молчит" \
  || { echo "FAIL закрытый ledger: хук что-то выдал"; fail=1; }

# 6. Источник не наш (startup) - молчит и на открытом ledger.
[ -z "$(run "$sid_b" startup)" ] && echo "ok   startup молчит" \
  || { echo "FAIL startup: хук что-то выдал"; fail=1; }

# 7. Норма и код называют один адрес. Проверки 1-6 гоняют только скрипт: адрес,
#    записанный прозой в движке и в README хука, они не исполняют, и правка
#    прозы в одну сторону осталась бы зелёной.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
engine="$root/plugins/ai-sdlc/dex-sdlc/skills/engine/SKILL.md"
hook_readme="$root/plugins/ai-sdlc/dex-sdlc-resume/README.md"
lit() { # <ярлык> <литерал> <файл>
  if grep -qF "$2" "$3"; then echo "ok   $1"; else echo "FAIL $1: '$2' не найден в $3"; fail=1; fi
}
lit "движок: адрес файла"        'auto-ledger/<TASK>.md'                "$engine"
lit "движок: папка сессии"       '<config>/projects/<slug>/<session>/'  "$engine"
lit "движок: запасная дверь"     '<config>/projects/<slug>/'            "$engine"
lit "движок: строка статуса"     'Статус: открыт'                       "$engine"
lit "README хука: папка сессии"  '<config>/projects/<slug>/<session>/'  "$hook_readme"
lit "README хука: запасная дверь" '<config>/projects/<slug>/'           "$hook_readme"
lit "README хука: строка статуса" 'Статус: открыт'                      "$hook_readme"
lit "движок: формула slug"       'символы вне `[A-Za-z0-9-]` -> `-`'    "$engine"
lit "хук: формула slug"          's/[^A-Za-z0-9-]/-/g'                  "$script"
lit "хук: имя подкаталога"       '/auto-ledger'                         "$script"
lit "хук: строка статуса"        'Статус:'                              "$script"

exit $fail
