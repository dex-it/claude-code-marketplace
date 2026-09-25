#!/usr/bin/env python3
# CLI ledger: адрес <config>/projects/<slug>/ledger/<TASK>/00-goal.md (ADR-0001 rev.6, ledger.md R1-R2).
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

USAGE = ("usage: ledger.py root|dir TASK|open TASK [MODE]|find|get TASK KEY|set TASK KEY VALUE|"
         "close TASK OUTCOME|open-tracks TASK|ctx TASK TRACK|trail TASK TRACK|findings TASK TRACK")

GOAL_TEMPLATE = ("# Цель: %s\n\nСтатус: открыт\nРежим: %s\nИсход: \nНехватка: \nОжидает: \n\n"
                 "## Цель\n\n## Критерий «готово»\n\n## Граница\n\n## Решения\n")


def die(message, code=64):
    sys.stderr.write(message + "\n")
    sys.exit(code)


def need_goal(task):
    path = dx.goal_file(task)
    if not os.path.isfile(path):
        sys.exit(1)
    return path


def main(argv):
    if not argv:
        die(USAGE)
    cmd, args = argv[0], argv[1:]

    if cmd == "root":
        print(dx.root())
    elif cmd == "dir":
        directory = dx.task_dir(args[0])
        os.makedirs(directory, exist_ok=True)
        print(directory)
    elif cmd == "open":
        task = args[0]
        mode = args[1] if len(args) > 1 else "autonomous"
        directory = dx.task_dir(task)
        os.makedirs(directory, exist_ok=True)
        path = os.path.join(directory, "00-goal.md")
        if not os.path.isfile(path):
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(GOAL_TEMPLATE % (task, mode))
        print(path)
    elif cmd == "find":
        for task, directory in dx.find_open():
            print("%s\t%s" % (task, directory))
    elif cmd == "get":
        print(dx.get_key(need_goal(args[0]), args[1]))
    elif cmd == "set":
        dx.set_key(need_goal(args[0]), args[1], args[2])
    elif cmd == "close":
        # Дефолта у исхода нет намеренно: подсказка «закрой цель» без него писала недоведённой цели complete (issue #250).
        path = need_goal(args[0])
        outcome = args[1] if len(args) > 1 else ""
        if outcome not in ("complete", "partial", "blocked"):
            die("ledger.py close: нужен исход - complete|partial|blocked")
        dx.set_key(path, "Исход", outcome)
        dx.set_key(path, "Статус", "закрыт")
    elif cmd == "open-tracks":
        for name in dx.open_tracks(args[0]):
            print(name)
    elif cmd == "ctx":
        for line in dx.section(dx.track_file(args[0], args[1]), "### Контекст", last_line_only=True):
            print(line)
    elif cmd == "trail":
        for line in dx.section(dx.track_file(args[0], args[1]), "### Исполнители"):
            print(line)
    elif cmd == "findings":
        try:
            found = dx.open_findings(dx.findings_file(args[0], args[1]), dx.track_file(args[0], args[1]))
        except ValueError as e:
            die("ledger.py findings: %s" % e, 5)
        if found:
            print(json.dumps(found, ensure_ascii=False, separators=(",", ":")))
    else:
        die(USAGE)


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except IndexError:
        die(USAGE)
