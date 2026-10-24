#!/usr/bin/env bash
# Второй оценщик вслепую (#302): ключ кейса + выход прогона -> вердикт по строкам ключа. Набор прогона не сообщается.
# judge-blind.sh <case> <файл выхода> <файл вердикта>; кейс в форме ключа: D1..D7, C1, T1..T3, W1..W5, P1, P2, R1, R0A, R2, R3, R0P, R0A2, R0P2, R0A3, R0P3
# Рабочий каталог - $G41_WORK/judge (вне репозитория).
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
SP="${G41_WORK:?}"; mkdir -p "$SP/judge"; cd "$SP/judge"
key="$here/key/$1.md"; outf="$2"; verdict="$3"
{ cat <<'PROMPT'
Ты оценщик прогона. Ниже - ключ кейса (что засеяно во входе, правило засчитывания каждой строки) и выход исполнителя:
дифф репозитория (документы, которые он написал или изменил) либо файл находок ревью. Правило засчитывания общее:
- K: автор - в документе решение из допустимых или вариант-ловушка явно отвергнут с причиной; молчание при ситуации
  или решение в варианте-ловушке - 0. Ревью - находка указывает на засеянное место или называет ситуацию в нём и её
  исход снимает дефект, severity не важна. Дифф ADR - по тому, что стало с файлами.
- P: автор - 0, если документ принимает решение, названное в строке провалом; ревью - 0, если находка по приманке
  требует правки с severity blocker или major; иначе 1.
- O: 1, если дефект найден (ревью) или требование выполнено (автор).
- Кейс без строк (только абзац «засчитан, если ни одной находки blocker/major») - одна строка ALL.
Для каждой строки ключа дай 1, 0 или n/a (только если ключ сам допускает n/a) и цитату из выхода до 200 символов
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
