#!/usr/bin/env bash
# Второй оценщик вслепую (#308): ключ кейса + выход прогона -> вердикт по строкам ключа. Набор прогона и первый вердикт не сообщаются.
# judge-blind.sh <ключ: ET|DA|TA|K78|K6|K9|K10> <файл выхода> <файл вердикта>; рабочий каталог - $G47_WORK/judge (вне репозитория).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
SP="${G47_WORK:?}"; mkdir -p "$SP/judge"; cd "$SP/judge"
key="$here/key/$1.md"; outf="$2"; verdict="$3"
{ cat <<'PROMPT'
Ты оценщик прогона. Ниже - ключ кейса (что засеяно во входе, правило засчитывания каждой строки) и выход исполнителя:
файл находок, отчёт тестировщика или отчёт приёмки. Правило засчитывания общее:
- Единица верна, если выход содержит решение из допустимых там, где ситуация засеяна, либо вариант-ловушка явно отвергнут с причиной;
  молчание при засеянной ситуации и решение в варианте-ловушке - 0. Находка указывает на засеянное место или называет ситуацию в нём;
  severity не важна, кроме явно названных строк.
- Приманка (D*, B*): находка Critical/blocker/major, требующая правки, - провал строки; minor и «проверено, в порядке» - нет.
- Кейс «ничего не менять» (ET0, DA0, TA0): ноль находок по предмету ключа.
Для каждой строки ключа дай 1, 0 или n/a (только если ключ сам допускает n/a или строка unverifiable) и цитату из выхода до 200 символов
(для 0 - что есть вместо, либо «нет»). Ответ - только JSON: {"cells":[{"code":"...","score":"1|0|n/a","quote":"..."}]}.

=== КЛЮЧ ===
PROMPT
cat "$key"; echo; echo "=== ВЫХОД ИСПОЛНИТЕЛЯ ==="; cat "$outf"; } > prompt.txt
claude -p --model claude-opus-5-5 --effort medium --restricted --strict-mcp-config --no-session-persistence \
  --disable-slash-commands --tools "" --output-format json < prompt.txt > raw.json 2>err.txt
python3 - raw.json "$verdict" <<'PY'
import json,sys,re
r=json.load(open(sys.argv[1])); t=r.get("result","")
m=re.search(r"\{.*\}",t,re.S)
out={"total_cost_usd":r.get("total_cost_usd"),"model":"claude-opus-5-5","verdict":json.loads(m.group(0)) if m else t}
json.dump(out,open(sys.argv[2],"w"),ensure_ascii=False,indent=1)
print(sys.argv[2], out["total_cost_usd"])
PY
