#!/usr/bin/env python3
# Stop: терминал цели этой сессии (компоненты 6, 8; N3; ledger.md T4). Своего потолка нет - повторные блоки одного хода снимает платформа.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

MESSAGE = ("dex-auto: цель {task} открыта ({dir}/00-goal.md). Остановка разрешена при одном из: Статус: закрыт "
           "(критерий «готово» подтверждён внешним фактом, ledger.py close {task}); Исход: blocked с непустой "
           "Нехватка:; Режим: interactive и Ожидает: оператор (значение перечислимое, уточнение причины - следом "
           "за словом). Критерий не подтверждён - цель не закрывай: ledger.py set {task} Исход blocked и "
           "ledger.py set {task} Нехватка <текст>. Иначе продолжай трек.")


def main():
    data = dx.event()
    if data is None:
        # Событие не разобрано: ход не блокируется, иначе сессию нечем закончить - но молчание названо оператору.
        sys.stderr.write("dex-auto: сторож остановки не разобрал событие Stop, терминал цели не проверен\n")
        return 0

    dx.bind_session(data)
    session = dx.field(data, "session_id")
    for task, directory in dx.find_open():
        if not session or dx.owner(task) != session:
            continue
        goal = os.path.join(directory, "00-goal.md")
        if dx.get_key(goal, "Исход") == "blocked" and dx.get_key(goal, "Нехватка"):
            continue
        # Сверка префиксом, не равенством: уточнение причины дописывают следом за словом (issue #250).
        if dx.get_key(goal, "Ожидает").startswith("оператор") and dx.get_key(goal, "Режим") == "interactive":
            continue
        sys.stderr.write(MESSAGE.format(task=task, dir=directory) + "\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
