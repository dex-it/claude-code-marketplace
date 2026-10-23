#!/usr/bin/env python3
# Сдача исхода прогона: возврат Workflow (stdin, JSON) -> файл трека и машинные строки цели.
import datetime
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

USAGE = ("usage: finish.sh TASK feature|bugfix|review|review-delta complete|partial|blocked "
         "[НЕХВАТКА] < return.json")
TRACKS = ("feature", "bugfix", "review", "review-delta")
OUTCOMES = ("complete", "partial", "blocked")
TRACK_LACK = "Нехватка трека"


def die(message, code):
    sys.stderr.write(message + "\n")
    sys.exit(code)


def text(value):
    # Форма jq: строка идёт как есть, прочее - компактным JSON, отсутствие - словом null.
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def items(data, key):
    value = data.get(key)
    return value if isinstance(value, list) else []


# Ключ возврата -> статус записи реестра; None - статус несёт сама находка, по умолчанию open.
FINDING_KEYS = (("open_findings", None), ("confirmed", "open"), ("claims", "unverified"),
                ("prior", None), ("dropped", "dropped"))
STATUSES = dx.OPEN_FINDING + ("closed", "disputed", "no-longer-applicable", "dropped")


def events(data):
    out = []
    for key, forced in FINDING_KEYS:
        for f in items(data, key):
            if not isinstance(f, dict):
                continue
            ev = {"anchor": f.get("anchor"), "evidence": f.get("reason")} if key == "dropped" else dict(f)
            status = forced or ev.get("status")
            # Статус вне словаря не закрывает находку: она остаётся в разности, а не выпадает молча.
            ev["status"] = status if status in STATUSES else "open"
            out.append(ev)
    return out


def register(path, state, evs, run, issued=None):
    # Находка без id - новая: опознание по anchor склеило бы разные находки одной строки.
    top = dx.findings_top(state)
    ids = [ev.get("id").strip() if isinstance(ev.get("id"), str) else "" for ev in evs]
    # Id выдал трек от findings_top (ledger.md R10), только если тот совпал с реестром: иначе номер выше реестра - чужой id, а не выданный.
    given = issued if isinstance(issued, int) and not isinstance(issued, bool) else None
    minted = {i for i in ids if given == top and i not in state and re.match(r"^F\d+$", i) and int(i[1:]) > top}
    top = dx.findings_top(dict.fromkeys(minted, None)) if minted else top
    changed = []
    for ev, fid in zip(evs, ids):
        # ref узла - его номер в выходе (R1), а ref реестра - поданный id не из реестра (ledger.md R9).
        ev = {k: v for k, v in ev.items() if k != "ref"}
        if fid in state:
            rec = dict(state[fid])
            # Пустой premise - суждение ревью «посылка доказана», а не молчание узла (ledger.md R9).
            rec.update({k: v for k, v in ev.items() if v not in ("", None, []) or k == "premise"})
        elif fid in minted:
            rec = dict(ev)
        else:
            # id не из реестра статус чужой записи не меняет (ledger.md R9): находка новая, поданный id - ссылкой.
            rec = dict(ev, ref=fid) if fid else dict(ev)
            top += 1
            fid = "F%d" % top
        rec["id"], rec["run"] = fid, run
        state[fid] = rec
        changed.append(rec)
    if changed:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write("".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in changed))
    return state, changed


def finding_line(rec, tail):
    severity = " [%s]" % text(rec["severity"]) if rec.get("severity") else ""
    return "- %s %s%s %s: %s" % (rec["id"], rec["status"], severity, text(rec.get("anchor")), tail)


def run_section(data, state, changed):
    out = ["### Петли"]
    loops = data.get("loops")
    if isinstance(loops, dict):
        out += ["- %s: %s" % (k, text(v)) for k, v in loops.items()]
    out += ["", "### Исполнители"]
    out += ["- " + text(e) for e in items(data, "trail")]
    # Раздел - разность реестра на конец прогона, а не находки этого прогона: молчание прогона о находке её не закрывает.
    out += ["", "### Открытые находки"]
    out += [finding_line(r, text(r.get("text")) + (" (закрытие: %s)" % text(r["closure"]) if r.get("closure") else "")
                         + (" (также: %s)" % ", ".join(text(x) for x in r["places"]) if isinstance(r.get("places"), list) and r["places"] else ""))
            for r in state.values() if r.get("status") in dx.OPEN_FINDING]
    out += ["- не опубликовано %s %s: %s" % (text(f.get("id")), text(f.get("anchor")), text(f.get("reason")))
            for f in items(data, "unpublished")]
    out += ["", "### Снято в прогоне"]
    out += [finding_line(r, text(r.get("evidence"))) for r in changed if r["status"] not in dx.OPEN_FINDING]
    # Продукт разведки (feature - ctx, bugfix - repro) переживает прогон: без него возобновление
    # заново покупает Explore/debugger и выводит номера R другим узлом, а находки прошлого прогона
    # ссылаются на прежние. Раздел идёт до «Решения»: тот пополняется дописыванием в конец файла.
    out += ["", "### Контекст"]
    scout = data.get("ctx") or data.get("repro")
    if scout:
        out.append(json.dumps(scout, ensure_ascii=False, separators=(",", ":")))
    out += ["", "### Решения"]
    out += ["- " + text(d) for d in items(data, "decisions")]
    out += ["- degraded: " + text(d) for d in items(data, "degraded")]
    out += ["- вопрос автору: " + text(q) for q in items(data, "questions")]
    return out


def lack_of(data, given):
    if given:
        return given
    missing = data.get("missing")
    if missing:
        return text(missing)
    where = data.get("where")
    return "узел не вернул выход, шаг %s" % ("неизвестен" if where is None or where is False else text(where))


def main(argv):
    task, track, outcome = (argv + ["", "", ""])[:3]
    lack = argv[3] if len(argv) > 3 else ""
    if not (task and track in TRACKS and outcome in OUTCOMES):
        die(USAGE, 64)

    try:
        data = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        data = None
    if not isinstance(data, dict):
        die("finish.sh: stdin не JSON-объект, ничего не записано", 4)

    goal = dx.goal_file(task)
    if not os.path.isfile(goal):
        die("finish.sh: цель %s не заведена (нет 00-goal.md)" % task, 1)
    # Пустой возврат принимает только blocked: прогон без петель и без исполнителей ненаблюдаем, а
    # complete и partial по нему записывали цели сделанный исход разделами, в которых ничего нет.
    if outcome != "blocked" and not (items(data, "trail") or data.get("loops")):
        die("finish.sh: в возврате нет ни loops, ни trail - прогона не было, исход %s сдавать нечем; "
            "пустой возврат сдаётся как blocked" % outcome, 65)

    path = dx.track_file(task, track)
    registry = dx.findings_file(task, track)
    legacy = not os.path.isfile(registry)
    try:
        state = dx.findings_state(registry, path)
    except ValueError as e:
        die("finish.sh: %s; ничего не записано" % e, 5)
    # Находки цели старого формата заводятся в реестр первыми: иначе после этого прогона их не отдаст ни реестр, ни файл трека.
    if legacy and state:
        with open(registry, "a", encoding="utf-8") as fh:
            fh.write("".join(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n" for r in state.values()))
    status = "закрыт" if outcome == "complete" else "открыт"
    if os.path.isfile(path):
        number = sum(1 for line in dx.lines_of(path) if line.startswith("## Прогон ")) + 1
        dx.set_key(path, "Статус", status)
    else:
        number = 1
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("# Трек: %s\n\ntrack=%s\nСтатус: %s\n" % (task, track, status))
    state, changed = register(registry, state, events(data), number, data.get("findings_top"))
    stamp = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n## Прогон %s (%s, исход %s)\n\n" % (number, stamp, outcome))
        fh.write("\n".join(run_section(data, state, changed)) + "\n")

    # «Нехватка» - последняя остановка цели, её пишут и гейты auto.md (set). «Нехватка трека» - только то, чего не довёл прогон
    # трека: её и подаёт «продолжить» как prior_missing, а непустая она запускает попытку кодера даже на зелёном дереве.
    if outcome == "complete":
        dx.set_key(goal, "Исход", "complete")
        dx.set_key(goal, "Статус", "закрыт")
        dx.set_key(goal, TRACK_LACK, "")
    elif outcome == "partial":
        dx.set_key(goal, "Исход", "partial")
        # Нехватка прошлого blocked-прогона закрыта этим: иначе «продолжить» вечно подавало бы её как prior_missing.
        dx.set_key(goal, "Нехватка", "")
        dx.set_key(goal, TRACK_LACK, "")
    else:
        dx.set_key(goal, "Исход", "blocked")
        dx.set_key(goal, "Нехватка", lack_of(data, lack))
        # Нехватку с аргументом (таймаут Workflow, null узла) и сбой узла внутри трека (node_failure) прогон трека не называл:
        # поле трека они не пишут и не снимают, иначе «продолжить» запустит кодера на зелёном дереве.
        if not lack and data.get("node_failure") is not True:
            dx.set_key(goal, TRACK_LACK, lack_of(data, ""))
    dx.claim(task)
    print(path)


if __name__ == "__main__":
    main(sys.argv[1:])
