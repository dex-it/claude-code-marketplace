#!/usr/bin/env bash
# Раннер задачи #215: приёмник получает выведенный артефакт, требование под которым изменено после написания.
# run-derived-from.sh <case> <set> <idx> [discipline-file]
#   case: pa-n (план, заметная правка), pa-s (план, тихая), pa-0 (план, правки только приманки),
#         ra-n, ra-s, ra-0 (то же для ADR-0009); суффикс b (pa-sb, ra-sb) - тихая правка мимо суда (повторной записи судьи нет)
#   set: c - контроль (без пина в шапке и без дисциплины); m - механизм (derived-from в шапке артефакта и файл дисциплины)
#   discipline-file: путь к файлу, который подаётся как скилл (для set=m); без него дисциплины нет.
# Рабочий каталог прогонов - $DF_WORK (вне репозитория: на пути не должно быть CLAUDE.md). Выход - в tests/trap-skills/derived-from/runs/<case>-<set><idx>/
set -uo pipefail
T="$(cd "$(dirname "$0")/../.." && pwd)"
SP="${DF_WORK:?DF_WORK - каталог прогонов вне репозитория}"
REPO="$(git -C "$T" rev-parse --show-toplevel)"
case "$SP/" in "$REPO"/*) echo "DF_WORK внутри репозитория"; exit 1;; esac
d="$SP"; while [[ $d != / ]]; do [[ -e $d/CLAUDE.md ]] && { echo "CLAUDE.md на пути: $d"; exit 1; }; d=$(dirname "$d"); done
case_="$1"; set_="$2"; idx="$3"; disc="${4:-}"
case $case_ in
 pa-n) ART=plan; KIND=loud; RJ=1;; pa-s) ART=plan; KIND=quiet; RJ=1;; pa-0) ART=plan; KIND=none; RJ=1;; pa-sb) ART=plan; KIND=quiet; RJ=0;;
 ra-n) ART=adr; KIND=loud; RJ=1;; ra-s) ART=adr; KIND=quiet; RJ=1;; ra-0) ART=adr; KIND=none; RJ=1;; ra-sb) ART=adr; KIND=quiet; RJ=0;;
 *) echo "неизвестный кейс $case_"; exit 1;; esac
PIN=0; [[ $set_ == m* ]] && PIN=1
id="$case_-$set_$idx"; W=$SP/w/$id; rm -rf "$W"; mkdir -p "$SP/w" "$SP/log"
DIR=$W/postline
bash $T/_projects/postline/derived/setup-derived.sh "$DIR" $ART $KIND $PIN $RJ >/dev/null 2>&1 || { echo "setup failed $id"; exit 1; }
b="derived-$ART-$KIND"
add=(); sline=""; used=""
if [[ -n $disc ]]; then mkdir -p $W/discipline; cp "$disc" "$W/discipline/"; used=$(basename "$disc" .md)
  add=(--add-dir "$W/discipline"); sline="Перед работой прочитай $(ls $W/discipline/* | tr '\n' ' ' | sed 's/ $//') - дисциплина, принятая в команде.
"; fi
dline="не читай и не пиши вне каталога репозитория${used:+, кроме файлов дисциплины выше}"
if [[ $ART == plan ]]; then
  P="Ты разработчик команды payments продукта Postline. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - $b; задача - docs/tasks/PL-34-review.md.
${sline}Проверь план docs/plans/PL-34.md перед началом работы: можно ли по нему начинать. Запиши находки в $DIR/REVIEW.md, по строке на находку: место в документе - что не так и чем кончится - severity (blocker/major/minor). Если находок нет, запиши в REVIEW.md одну строку «находок нет». Без вступлений и резюме. План не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; $dline. Из команд доступен только git. В ответе - только число находок по severity."
else
  P="Ты ревьюер дизайна в команде продукта Postline. Git-репозиторий лежит в каталоге $DIR ; текущая ветка - $b; задача - docs/tasks/PL-35.md.
${sline}Оцени документ docs/adr/ADR-0009-image-previews.md: можно ли его принимать. Запиши находки в $DIR/REVIEW.md, по строке на находку: место в документе - что не так и чем кончится - severity (blocker/major/minor). Если находок нет, запиши в REVIEW.md одну строку «находок нет». Без вступлений и резюме. Документ не правь.
Ограничения: не вызывай Skill tool; не меняй файлы репозитория, кроме REVIEW.md; $dline. Из команд доступен только git. В ответе - только число находок по severity."
fi
cd "$DIR"
claude -p "$P" --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config \
  --no-session-persistence --disable-slash-commands --permission-mode acceptEdits --max-budget-usd 1 \
  --tools Read Write Edit Glob Grep Bash --allowedTools 'Bash(git *)' "${add[@]}" \
  --output-format stream-json --verbose > $SP/log/$id.jsonl 2>$SP/log/$id.err
R=$T/derived-from/runs/$id; rm -rf "$R"; mkdir -p "$R"
cp REVIEW.md "$R/REVIEW.md" 2>/dev/null || echo "(нет REVIEW.md)" > "$R/REVIEW.md"
python3 - "$SP/log/$id.jsonl" "$DIR" "$W/discipline" "$REPO" "$R" "$used" <<'PY'
import json,sys,re,os
log,d,disc,repo,R,used=sys.argv[1:]
init=res=None; bad=set(); reads=[]
for l in open(log):
  try: m=json.loads(l)
  except Exception: continue
  if m.get("type")=="system" and m.get("subtype")=="init": init=m
  if m.get("type")=="result": res=m
  msg=m.get("message")
  for c in (msg.get("content",[]) if isinstance(msg,dict) else []):
    if isinstance(c,dict) and c.get("type")=="tool_use":
      i=c.get("input",{}); p=i.get("file_path") or i.get("path") or ""
      if c.get("name")=="Read" and p: reads.append(p.replace(d+"/",""))
      if p.startswith("/") and not (p.startswith(d) or p.startswith(disc)): bad.add(p)
      cmd=i.get("command","")
      if repo in cmd or "/.claude/" in cmd: bad.add("cmd:"+cmd[:80])
meta={"model":(init or {}).get("model"),"claude_code_version":(init or {}).get("claude_code_version"),
 "skills_in_session":(init or {}).get("skills"),"mcp_servers":(init or {}).get("mcp_servers"),
 "discipline":used.split(),"total_cost_usd":(res or {}).get("total_cost_usd"),"subtype":(res or {}).get("subtype"),
 "num_turns":(res or {}).get("num_turns"),"escapes":sorted(bad),"read":reads}
json.dump(meta,open(os.path.join(R,"meta.json"),"w"),ensure_ascii=False,indent=1)
for f in os.listdir(R):
  p=os.path.join(R,f); t=open(p,encoding="utf-8",errors="replace").read()
  t=t.replace(d,"<run>").replace(disc,"<discipline>").replace(repo,"<repo>")
  open(p,"w",encoding="utf-8").write(t)
print(f'{os.path.basename(R)} cost={meta["total_cost_usd"]} {meta["subtype"]} cli={meta["claude_code_version"]} esc={meta["escapes"]}')
PY
