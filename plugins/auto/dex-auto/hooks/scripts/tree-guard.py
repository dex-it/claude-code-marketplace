#!/usr/bin/env python3
# PreToolUse: `args.cwd` промпта рабочим каталогом процесса не является, поэтому дерево трека принуждает хук (issue #252).
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

WATCHED = ("Write", "Edit", "MultiEdit", "NotebookEdit", "Bash")
TOKEN_TAIL = re.compile(r"[A-Za-z0-9._-]")


def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason[:600],
    }}, ensure_ascii=False))
    sys.exit(0)


def names(command, path):
    # Назвать дерево мало: составная команда правила бы общее дерево вторым звеном через `; cd`.
    for match in re.finditer(re.escape(path), command):
        tail = command[match.end():]
        if tail.startswith("/../") or tail == "/..":
            continue
        if not tail or not TOKEN_TAIL.match(tail):
            return True
    return False


def main():
    data = dx.event()
    if data is None:
        # Событие не разобрано: молчать здесь и есть та дыра, ради которой сторож заведён.
        if dx.find_open():
            deny("dex-auto: сторож дерева трека не разобрал событие PreToolUse. Событие не является валидным JSON.")
        return

    # Узлы движка спавнит Workflow; прочие субагенты приходят с именем своего типа и не сторожатся.
    if data.get("agent_type") != "workflow-subagent":
        return
    tool = dx.field(data, "tool_name")
    if tool not in WATCHED:
        return

    os.environ["DEX_AUTO_CWD"] = dx.field(data, "cwd") or os.getcwd()
    goals = dx.find_open()
    if not goals:
        return

    main_path = dx.main_root()
    trees, listed = [], []
    for task, _ in goals:
        if main_path is None:
            break
        path = dx.worktree_path(main_path, task)
        if not os.path.isdir(path):
            continue
        canon = os.path.realpath(path)
        listed.append(canon)
        # Обе формы: путь дерева приходит узлу из промпта неканоническим, а сверяется он с каноническим.
        trees.append(canon)
        if canon != path:
            trees.append(path)
    # Дерева нет ни у одной открытой цели - трек не запускался, сторожить нечего.
    if not trees:
        return
    listing = " ".join(listed)

    if tool == "Bash":
        subject = dx.field(data, "tool_input.command")
        what = "команда"
    else:
        subject = dx.field(data, "tool_input.file_path") or dx.field(data, "tool_input.notebook_path")
        what = "путь"
    if not subject:
        deny("dex-auto: сторож дерева трека не нашёл в событии предмет вызова (%s). "
             "Подай инструменту путь внутри дерева трека." % tool)

    if tool == "Bash":
        canon_main = os.path.realpath(main_path) if main_path else None
        if canon_main and (names(subject, canon_main) or names(subject, main_path)):
            deny("dex-auto: команда узла называет общее дерево сессии (%s), а трек работает только в своём (%s): %s. "
                 "Убери обращение к общему дереву - оно только на чтение, и читается Read/Grep, не через Bash."
                 % (canon_main, listing, subject))
        for path in trees:
            if names(subject, path):
                return
        deny("dex-auto: узел трека запускает команды только в дереве открытой цели (%s), а эта его не называет: %s. "
             "Префиксуй cd <дерево> && ... либо подай инструменту путь дерева. Каталог сессии - только на чтение, "
             "и читается Read/Grep, не через Bash." % (listing, subject))

    if not subject.startswith("/"):
        deny("dex-auto: узел трека правит только дерево открытой цели (%s), а %s задан относительно каталога сессии: %s. "
             "Пиши по абсолютному пути внутри дерева." % (listing, what, subject))
    target = os.path.realpath(subject)
    for path in trees:
        if target == path or target.startswith(path + os.sep):
            return
    deny("dex-auto: узел трека правит только дерево открытой цели (%s), а %s ведёт наружу: %s. "
         "Пиши по абсолютному пути внутри дерева; каталог сессии - только на чтение." % (listing, what, subject))


if __name__ == "__main__":
    main()
