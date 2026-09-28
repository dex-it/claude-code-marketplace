#!/usr/bin/env python3
# PreToolUse: узел трека работает в дереве, куда главный поток вошёл до запуска (P34); хук - страховка, что дерево сессии узел не трогает.
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

WATCHED = ("Write", "Edit", "MultiEdit", "NotebookEdit", "Bash")
TOKEN_TAIL = re.compile(r"[A-Za-z0-9._-]")
# Абсолютный путь с начала слова: `cat $W/../repo/a` называет дерево сессии, не называя его буквально.
ABS_PATH = re.compile(r"(?<![^\s'\"`=:;|&<>(])/[^\s'\"`:;|&<>()$]*")


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


def operator_subagent(data):
    # Событием узел Workflow от субагента Agent не отличить, различает место транскрипта (P33); файла нет - сторожим.
    path = dx.field(data, "transcript_path")
    if not path.endswith(".jsonl"):
        return False
    return os.path.isfile(os.path.join(path[:-len(".jsonl")], "subagents", "agent-%s.jsonl" % dx.field(data, "agent_id")))


def inside(path, root):
    return path == root or path.startswith(root + os.sep)


def main():
    data = dx.event()
    if data is None:
        # Событие не разобрано: молчать здесь и есть та дыра, ради которой сторож заведён.
        dx.bind_session(None)
        if dx.find_open():
            deny("dex-auto: сторож дерева трека не разобрал событие PreToolUse. Событие не является валидным JSON.")
        return

    if not dx.field(data, "agent_id") or operator_subagent(data):
        return
    tool = dx.field(data, "tool_name")
    if tool not in WATCHED:
        return

    dx.bind_session(data)
    goals = dx.find_open()
    if not goals:
        return
    main_path = dx.main_root()
    if main_path is None:
        return
    base = dx.tree_base(main_path)
    listed = [os.path.realpath(p) for p in (dx.worktree_path(base, task) for task, _ in goals) if os.path.isdir(p)]
    # Дерева нет ни у одной открытой цели - трек не запускался, сторожить нечего.
    if not listed:
        return
    listing = " ".join(listed)
    canon_main = os.path.realpath(main_path)
    here = os.path.realpath(dx.field(data, "cwd") or os.getcwd())

    if inside(here, canon_main):
        deny("dex-auto: субагент запущен в дереве сессии (%s) при открытой цели с деревом трека (%s). Ничего не выполняй. "
             "Узел трека: главный поток не вошёл в дерево трека до запуска Workflow - верни status: blocked с этой нехваткой. "
             "Узел другого Workflow: дерево сессии закрыто, пока цель открыта - верни эту причину вызывающему." % (canon_main, listing))

    if tool == "Bash":
        subject = dx.field(data, "tool_input.command")
    else:
        subject = dx.field(data, "tool_input.file_path") or dx.field(data, "tool_input.notebook_path")
    if not subject:
        deny("dex-auto: сторож дерева трека не нашёл в событии предмет вызова (%s)." % tool)

    if tool == "Bash":
        if (names(subject, canon_main) or names(subject, main_path)
                or any(inside(os.path.realpath(m.group(0)), canon_main) for m in ABS_PATH.finditer(subject))):
            deny("dex-auto: команда узла ведёт в дерево сессии (%s), а узел трека работает в дереве открытой цели (%s): %s. "
                 "Работай в рабочем каталоге, путь дерева сессии не называй." % (canon_main, listing, subject))
        return

    if inside(os.path.realpath(os.path.join(here, subject)), canon_main):
        deny("dex-auto: правка узла ведёт в дерево сессии (%s), а узел трека правит дерево открытой цели (%s): %s. "
             "Пиши в рабочем каталоге." % (canon_main, listing, subject))


if __name__ == "__main__":
    main()
