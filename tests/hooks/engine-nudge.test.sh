#!/usr/bin/env bash
# Регрессия снятого условия «молчим вне git-репозитория» (1.2.0). Условие рубило
# инжект в моно-каталоге, где корень держит клоны подкаталогами и сам репой не
# является. Платный прогон активации это не ловит: замер 01.09.2026 показал, что
# кейс `engine-nogit-in` зелёный и на старом хуке (2/2), потому что на его промпте
# модель поднимает движок примерно в половине запусков без всякой подсказки
# (без хука 1/2). Значит механизм надо пиннить прямым запуском скрипта, а не
# кейсом набора. Проверки 1-4 гоняют скрипт, 5 - прозу README и код: без неё
# возврат условия в один из носителей остался бы зелёным.
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
script="$root/plugins/ai-sdlc/dex-sdlc-nudge/hooks/scripts/engine-nudge.sh"
readme="$root/plugins/ai-sdlc/dex-sdlc-nudge/README.md"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/plain" "$tmp/repo"
git -C "$tmp/repo" init -q 2>/dev/null || true

fail=0
ok()   { echo "ok   $1"; }
bad()  { echo "FAIL $1: $2"; fail=1; }
run()  { printf '{"cwd":"%s","prompt":"Реализуй экспорт в CSV"}' "$1" | (cd "$1" && bash "$script"); }

# 1. Вне git-репозитория хук обязан говорить: это и есть снятое условие.
out=$(run "$tmp/plain"); rc=$?
[ $rc -eq 0 ] || bad "вне репы: код возврата" "получен $rc"
if printf '%s' "$out" | grep -qF '"additionalContext"'; then ok "вне репы инжект выдан"
else bad "вне репы инжект выдан" "выход пуст либо без additionalContext"; fi

# 2. В репозитории поведение то же: условий в хуке нет вовсе.
if printf '%s' "$(run "$tmp/repo")" | grep -qF '"additionalContext"'; then ok "в репе инжект выдан"
else bad "в репе инжект выдан" "выход пуст"; fi

# 2b. Состав перечня родов работы пиннится: правка текста инжекта иначе проходит молча,
# а перечень держит узнаваемость формулировок, на которых снят замер (README, «Почему перечень»).
for kind in 'implementation' 'bug fix' 'tests' 'MR review' 'review follow-up' 'stand acceptance' \
           'failure diagnosis' 'requirements' 'design' 'documentation' 'code overview' 'project rulebook'; do
  if printf '%s' "$out" | grep -qF "$kind"; then ok "перечень несёт род работы: $kind"
  else bad "перечень несёт род работы: $kind" "рода нет в тексте инжекта"; fi
done

# 3. Выход - валидный JSON нужного события. Битый JSON рантайм проглотит молча.
if printf '%s' "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)['hookSpecificOutput']
assert d['hookEventName']=='UserPromptSubmit', d['hookEventName']
assert d['additionalContext'].strip()
" 2>/dev/null; then ok "JSON валиден и событие названо"
else bad "JSON валиден и событие названо" "разбор не прошёл"; fi

# 4. Без jq хук обязан работать: разбор cwd ушёл вместе с условием, и вернуть
#    зависимость незаметно нельзя. PATH подменяется на пустой каталог плюс bash.
mkdir -p "$tmp/bin"
ln -sf "$(command -v bash)" "$tmp/bin/bash" 2>/dev/null || cp "$(command -v bash)" "$tmp/bin/bash"
ln -sf "$(command -v cat)"  "$tmp/bin/cat"  2>/dev/null || cp "$(command -v cat)"  "$tmp/bin/cat"
nojq=$(printf '{"cwd":"%s"}' "$tmp/plain" | PATH="$tmp/bin" bash "$script" 2>/dev/null)
if printf '%s' "$nojq" | grep -qF '"additionalContext"'; then ok "работает без jq в PATH"
else bad "работает без jq в PATH" "выход пуст"; fi

# 5. Носители решения - код и проза README. Проверки 1-4 прозу не исполняют.
if grep -qF 'git rev-parse' "$script"; then bad "в скрипте нет проверки каталога" "'git rev-parse' вернулся в скрипт"
else ok "в скрипте нет проверки каталога"; fi
if grep -qF 'jq ' "$script"; then bad "в скрипте нет jq" "'jq' вернулся в скрипт"
else ok "в скрипте нет jq"; fi
if grep -qF 'любой каталог, репозиторий там' "$readme"; then ok "README называет радиус"
else bad "README называет радиус" "формулировка радиуса пропала из README"; fi

exit $fail
