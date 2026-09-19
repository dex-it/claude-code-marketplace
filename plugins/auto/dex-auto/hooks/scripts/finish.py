#!/usr/bin/env python3
# Сдача исхода прогона: возврат Workflow (stdin, JSON) -> файл трека и машинные строки цели.
import datetime
import json
import os
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


def run_section(data):
    out = ["### Петли"]
    loops = data.get("loops")
    if isinstance(loops, dict):
        out += ["- %s: %s" % (k, text(v)) for k, v in loops.items()]
    out += ["", "### Исполнители"]
    out += ["- " + text(e) for e in items(data, "trail")]
    out += ["", "### Открытые находки"]
    out += ["- [%s] %s: %s" % (text(f.get("severity")), text(f.get("anchor")), text(f.get("text")))
            for f in items(data, "open_findings")]
    out += ["- [%s] %s: %s (закрытие: %s)" % (text(f.get("severity")), text(f.get("anchor")),
                                              text(f.get("text")), text(f.get("closure")))
            for f in items(data, "confirmed")]
    out += ["- не опубликовано %s: %s" % (text(f.get("anchor")), text(f.get("reason")))
            for f in items(data, "unpublished")]
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
    out += ["- снято %s: %s" % (text(d.get("anchor")), text(d.get("reason")))
            for d in items(data, "dropped")]
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
    status = "закрыт" if outcome == "complete" else "открыт"
    if os.path.isfile(path):
        number = sum(1 for line in dx.lines_of(path) if line.startswith("## Прогон ")) + 1
        dx.set_key(path, "Статус", status)
    else:
        number = 1
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("# Трек: %s\n\ntrack=%s\nСтатус: %s\n" % (task, track, status))
    stamp = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("\n## Прогон %s (%s, исход %s)\n\n" % (number, stamp, outcome))
        fh.write("\n".join(run_section(data)) + "\n")

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
