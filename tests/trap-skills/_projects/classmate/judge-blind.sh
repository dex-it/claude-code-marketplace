#!/usr/bin/env bash
# judge-blind.sh <кейс в форме ключа> <выход прогона (каталог runs/<id>)> <файл вердикта>; набор прогона оценщику не сообщается.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
SP="${G48_WORK:?}"; mkdir -p "$SP/judge"
key="$here/key/$1.md"; run="$(realpath "$2")"; verdict="$(realpath -m "$3")"
[[ -f $key ]] || { echo "нет ключа $key"; exit 1; }
cd "$(mktemp -d "$SP/judge/$1-XXXX")"
{ cat <<'PROMPT'
Ты оценщик прогона. Ниже - ключ кейса (что засеяно во входе, правило засчитывания каждой строки) и выход исполнителя:
дифф репозитория (что он написал или изменил), ответ исполнителя, handoff либо файл находок ревью. Правило
засчитывания общее:
- K: автор - в выходе решение из допустимых в месте, где решается ситуация, или вариант-ловушка явно отвергнут с
  причиной; молчание при ситуации или решение в варианте-ловушке - 0. Ревью - находка указывает на засеянное место
  или называет ситуацию в нём и её исход снимает дефект, severity не важна. Handoff - по исходу треда и кандидату.
- P: автор - 0, если выход принимает решение, названное в строке провалом; ревью - 0, если находка по приманке
  требует правки с severity blocker или major (вердикт свода - если находка помечена блокирующей); иначе 1.
- O: 1, если дефект найден (ревью) или требование выполнено (автор).
- Строки «-K», «-all», «-Kf», «-V» кейса «ничего не менять»: «-K», «-all», «-V» - 1 или 0 по условию строки; «-Kf»
  - в score число, в quote перечень.
Для каждой строки ключа дай 1, 0 или n/a (только если ключ сам допускает n/a) и цитату из выхода до 200 символов
(для 0 - что есть вместо, либо «нет»). Ответ - только JSON: {"cells":[{"code":"...","score":"...","quote":"..."}]}.

=== КЛЮЧ ===
PROMPT
cat "$key"; echo; echo "=== ВЫХОД ИСПОЛНИТЕЛЯ ==="
for f in DIFF.patch REPLY.md HANDOFF.md REVIEW.md; do [[ -f $run/$f ]] && { echo "--- $f"; cat "$run/$f"; echo; }; done
} > prompt.txt
claude -p --model claude-opus-5-5 --effort medium --restricted --strict-mcp-config --no-session-persistence \
  --disable-slash-commands --tools "" --output-format json < prompt.txt > raw.json 2>err.txt
python3 - raw.json "$verdict" <<'PY'
import json,sys,re
r=json.load(open(sys.argv[1])); t=r.get("result","")
m=re.search(r"\{.*\}",t,re.S)
try: v=json.loads(m.group(0))
except Exception: v=t
out={"total_cost_usd":r.get("total_cost_usd"),"model":"claude-opus-5-5","verdict":v}
json.dump(out,open(sys.argv[2],"w"),ensure_ascii=False,indent=1)
print(sys.argv[2], out["total_cost_usd"])
PY
