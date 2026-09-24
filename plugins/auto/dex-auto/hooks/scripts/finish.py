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


def register(path, state, evs, run):
    # Находка без id - новая: опознание по anchor склеило бы разные находки одной строки.
    number = lambda i: int(i[1:]) if re.match(r"^F\d+$", i) else 0
    top = max([number(i) for i in state] + [0])
    changed = []
    for ev in evs:
        fid = ev.get("id") if isinstance(ev.get("id"), str) else ""
        if fid in state:
            rec = dict(state[fid])
            rec.update({k: v for k, v in ev.items() if v not in ("", None)})
        else:
            if not fid:
                top += 1
                fid = "F%d" % top
            top = max(top, number(fid))
            rec = dict(ev)
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
    out += [finding_line(r, text(r.get("text")) + (" (закрытие: %s)" % text(r["closure"]) if r.get("closure") else ""))
            for r in state.values() if r.get("status") in dx.OPEN_FINDING]
    out += ["- не опубликовано %s: %s" % (text(f.get("anchor")), text(f.get("reason")))
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
    out += ["- узел заменён: " + text(d) for d in items(data, "degraded")]
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
    try:
        state = dx.findings_state(registry)
    except ValueError as e:
        die("finish.sh: %s; ничего не записано" % e, 5)
    status = "закрыт" if outcome == "complete" else "открыт"
    if os.path.isfile(path):
        number = sum(1 for line in dx.lines_of(path) if line.startswith("## Прогон ")) + 1
        dx.set_key(path, "Статус", status)
    else:
        number = 1
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("# Трек: %s\n\ntrack=%s\nСтатус: %s\n" % (task, track, status))
    state, changed = register(registry, state, events(data), number)
    stamp = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n## Прогон %s (%s, исход %s)\n\n" % (number, stamp, outcome))
        fh.write("\n".join(run_section(data, state, changed)) + "\n")

    if outcome == "complete":
        dx.set_key(goal, "Исход", "complete")
        dx.set_key(goal, "Статус", "закрыт")
    elif outcome == "partial":
        dx.set_key(goal, "Исход", "partial")
    else:
        dx.set_key(goal, "Исход", "blocked")
        dx.set_key(goal, "Нехватка", lack_of(data, lack))
    print(path)


if __name__ == "__main__":
    main(sys.argv[1:])
