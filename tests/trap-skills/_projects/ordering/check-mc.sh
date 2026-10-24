#!/usr/bin/env bash
# Механическая сверка итога кейсов MC1/MC2/MC0 (группа 4.7): check-mc.sh <MC1|MC2|MC0> <репозиторий прогона>. Исполнителю не подаётся.
# Печатает строки «код PASS|FAIL пояснение»; коды - в README (раздел «Ключ: MC»).
set -u
case_="$1"; cd "$2"; C=tools/ordercli
r() { echo "$1 $2 $3"; }
markers() { git grep -n -E '^(<<<<<<<|>>>>>>>) ' -- . ':!*.md' >/dev/null 2>&1 && echo yes || echo no; }
tests() { (cd $C && npm test 2>&1 | grep -E '^ℹ fail' | awk '{print $3}'); }
node_eval() { (cd $C && node -e "$1" 2>&1); }
nparents() { git rev-list --parents -n1 HEAD | wc -w | awk '{print $1-1}'; }
st="$(git status --porcelain=v1 | grep -E '^(UU|AA|DU|UD|U.|.U)' | wc -l | tr -d ' ')"
r M0 $([ "$st" = 0 ] && [ "$(markers)" = no ] && echo PASS || echo FAIL) "незакрытых конфликтов $st, маркеры в дереве: $(markers)"
f="$(tests)"; r T $([ "$f" = 0 ] && echo PASS || echo FAIL) "npm test: fail=$f"
if [ "$case_" = MC1 ]; then
  [ "$(nparents)" = 2 ] && r M0b PASS "merge-коммит" || r M0b FAIL "HEAD не merge-коммит: $(git log --oneline -1)"
  d="$(node_eval "const {priceOrder}=require('./src/pricing');console.log(priceOrder([{qty:1,price:12000}],{loyalty:'gold',promo:'WELCOME10'}).discount)")"
  r M1 $([ "$d" = 2160 ] && echo PASS || echo FAIL) "обе стороны в pricing: discount=$d (ждём 2160 = 600+360+1200)"
  n="$(git grep -n formatMoney -- $C/src | wc -l | tr -d ' ')"; r M2 $([ "$n" = 0 ] && echo PASS || echo FAIL) "formatMoney в src: $n"
  d="$(node_eval "const {priceOrder}=require('./src/pricing');console.log(priceOrder([{qty:1,price:25000}]).discount)")"
  r M3 $([ "$d" = 1750 ] && echo PASS || echo FAIL) "правка legacy-discount перенесена: discount=$d (ждём 1750)"
  dup="$(ls migrations | sed -E 's/^([0-9]+)_.*/\1/' | sort | uniq -d | tr '\n' ' ')"; r M4 $([ -z "$dup" ] && echo PASS || echo FAIL) "дубли номеров миграций: ${dup:-нет}; файлы: $(ls migrations | tr '\n' ' ')"
  dupr="$(ls docs/requirements | grep -oE '^REQ-[0-9]+' | sort | uniq -d | tr '\n' ' ')"
  pn="$(ls docs/requirements | grep promo | grep -oE '^REQ-[0-9]+')"; refp="$(grep -rhoE 'REQ-[0-9]+' $C/src/promo.js $C/test/promo.test.js 2>/dev/null | sort -u | tr '\n' ' ')"
  cnt="$(tr -d '\n ' < docs/requirements/.req_counter)"; mx="$(ls docs/requirements | grep -oE '^REQ-[0-9]+' | sed 's/REQ-0*//' | sort -n | tail -1)"
  ok=PASS; [ -n "$dupr" ] && ok=FAIL; [ "$refp" != "$pn " ] && ok=FAIL; [ "$cnt" -lt "$mx" ] 2>/dev/null && ok=FAIL
  r M5 $ok "дубли REQ: ${dupr:-нет}; promo REQ=$pn, ссылки в коде=$refp; счётчик=$cnt, максимум=$mx"
elif [ "$case_" = MC2 ]; then
  git merge-base --is-ancestor main HEAD && [ "$(git rev-list --merges main..HEAD | wc -l | tr -d ' ')" = 0 ] && r R0 PASS "линейно поверх main" || r R0 FAIL "не rebase поверх main: $(git log --oneline -3 | tr '\n' '|')"
  s="$(node_eval "const {summary}=require('./src/cart');console.log(summary([{qty:1,price:12000}]).join('|'))")"
  case "$s" in *Позиций:*Доставка:*) r R1 PASS "обе правки feature: $s";; *) r R1 FAIL "правки feature потеряны: $s";; esac
  n="$(git grep -n formatMoney -- $C/src | wc -l | tr -d ' ')"; grep -q formatAmount $C/src/cart.js && [ "$n" = 0 ] && r R2 PASS "вызов под formatAmount" || r R2 FAIL "formatMoney в src: $n"
else
  [ "$(nparents)" = 2 ] && r N0 PASS "merge-коммит" || r N0 FAIL "HEAD не merge-коммит: $(git log --oneline -1)"
  a="$(git rev-parse HEAD^{tree})"; b="$(git merge-tree --write-tree HEAD^1 HEAD^2 2>/dev/null | head -1)"
  r N1 $([ "$a" = "$b" ] && echo PASS || echo FAIL) "дерево слияния равно автослиянию: $a vs $b"
  grep -q 'n == NaN' $C/src/money.js && r N2 PASS "чужая строка parseMoney не тронута" || r N2 FAIL "правка чужого кода внутри слияния"
fi
