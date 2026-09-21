#!/usr/bin/env python3
# SessionStart: подъём открытой цели после startup / resume / compact (компонент 11, N3).
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

# `clear` в перечне нет намеренно: /clear - жест «забудь», всплывающая после него цель делает жест невыполнимым (ledger.md T1).
SOURCES = ("startup", "resume", "compact")
SKIP = re.compile(r"^(Вид|Источник):")
MESSAGE = ("dex-auto: открытая цель {task} - {goal}. Ledger: {dir}. Первое действие: Read {dir}/00-goal.md{tracks}; "
           "{command}; критерий «готово» подтверждён - закрой цель (ledger.py close {task} complete), при тупике цель "
           "не закрывай, а назови нехватку (ledger.py set {task} Исход blocked и ledger.py set {task} Нехватка <текст>).")
# Аргумент по факту: «продолжить» даёт треку resume, а тот входит в правку только по красной верификации - на цели без прогона это пропускает фазу правки целиком.
RESUME = "затем продолжай командой /dex-auto:auto {task} продолжить"
START = "трека по этой цели не было - запусти командой /dex-auto:auto {task}, без «продолжить»: возобновлять нечего"


def goal_line(path):
    inside = False
    for line in dx.lines_of(path):
        if line.startswith("## Цель"):
            inside = True
            continue
        if inside and line.startswith("#"):
            break
        if inside and line.strip() and not SKIP.match(line):
            return line
    return "(цель не заполнена)"


def main():
    data = dx.event()
    if data is None:
        sys.stderr.write("dex-auto: хук старта не разобрал событие SessionStart, открытая цель не поднята\n")
        return

    if (dx.field(data, "source") or "startup") not in SOURCES:
        return
    os.environ["DEX_AUTO_CWD"] = dx.field(data, "cwd") or os.getcwd()
    # Числа открытых целей хук не судит: несколько живых целей - принятая цена адреса ledger (ledger.md R2).
    for task, directory in dx.find_open():
        open_tracks = dx.open_tracks(task)
        tracks = " и файлы трека " + " ".join(open_tracks) if open_tracks else ""
        command = (RESUME if open_tracks else START).format(task=task)
        print(MESSAGE.format(task=task, dir=directory, tracks=tracks, command=command,
                             goal=goal_line(os.path.join(directory, "00-goal.md"))))


if __name__ == "__main__":
    main()
