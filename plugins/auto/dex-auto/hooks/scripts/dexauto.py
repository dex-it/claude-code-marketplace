#!/usr/bin/env python3
# Единственный дом чтения и записи ledger: разбор, размазанный по шести скриптам, расходился молча.
import json
import os
import re
import subprocess
import sys

# Формула slug та же, которой host именует папку проекта; расхождение наблюдается только чтением (ADR-0001, долг 2).
SLUG_BAD = re.compile(r"[^A-Za-z0-9-]")
# Поле шапки: `Ключ: значение` либо `track=значение`. Заголовок `# Цель:` отсечён классом первого символа.
FIELD = re.compile(r"^([^\s#:=][^:=]*?)\s*([:=])\s?(.*)$")


def config_dir():
    return os.environ.get("CLAUDE_CONFIG_DIR") or os.path.join(os.path.expanduser("~"), ".claude")


def cwd():
    return os.environ.get("DEX_AUTO_CWD") or os.getcwd()


def slug(text):
    return SLUG_BAD.sub("-", text)


def root():
    return os.path.join(config_dir(), "projects", slug(cwd()), "ledger")


def task_dir(task):
    return os.path.join(root(), slug(task))


def goal_file(task):
    return os.path.join(task_dir(task), "00-goal.md")


def track_file(task, track):
    base = track[:-len("-delta")] if track.endswith("-delta") else track
    return os.path.join(task_dir(task), "01-%s.md" % base)


def lines_of(path):
    # CR снимается здесь, а не у каждого читателя: файл, правленный на Windows, гасил сверку значений молча.
    with open(path, encoding="utf-8", errors="replace") as fh:
        return fh.read().replace("\r\n", "\n").replace("\r", "\n").split("\n")


def head_end(lines):
    for i, line in enumerate(lines):
        if line.startswith("##"):
            return i
    return len(lines)


def get_key(path, key):
    try:
        lines = lines_of(path)
    except OSError:
        return ""
    end = head_end(lines)
    for line in lines[:end]:
        m = FIELD.match(line)
        if m and m.group(1) == key:
            return m.group(3).strip()
    # Совместимость: поле, уехавшее в тело прежней версией set_key, читается по прежнему правилу.
    prefix = key + ":"
    for line in lines[end:]:
        if line.startswith(prefix):
            return line[len(prefix):].strip()
    return ""


def set_key(path, key, value):
    lines = lines_of(path)
    end = head_end(lines)
    for i in range(end):
        m = FIELD.match(lines[i])
        if m and m.group(1) == key:
            lines[i] = "%s%s%s" % (key, m.group(2), value if m.group(2) == "=" else " " + value)
            return write_lines(path, lines)
    insert = end
    while insert > 0 and lines[insert - 1].strip() == "":
        insert -= 1
    lines.insert(insert, "%s: %s" % (key, value))
    return write_lines(path, lines)


def write_lines(path, lines):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))
    os.replace(tmp, path)


def find_open():
    result = []
    base = root()
    if not os.path.isdir(base):
        return result
    for name in sorted(os.listdir(base)):
        directory = os.path.join(base, name)
        goal = os.path.join(directory, "00-goal.md")
        if os.path.isfile(goal) and get_key(goal, "Статус") == "открыт":
            result.append((name, directory))
    return result


def open_tracks(task):
    directory = task_dir(task)
    if not os.path.isdir(directory):
        return []
    result = []
    for name in sorted(os.listdir(directory)):
        if name == "00-goal.md" or not re.match(r"^\d\d-.*\.md$", name):
            continue
        if get_key(os.path.join(directory, name), "Статус") == "открыт":
            result.append(name)
    return result


def section(path, title, last_run_only=False, last_line_only=False):
    if not os.path.isfile(path):
        return []
    collected = []
    inside = False
    for line in lines_of(path):
        if last_run_only and line.startswith("## Прогон "):
            collected = []
            inside = False
        if line.startswith(title):
            inside = True
            continue
        if line.startswith("#"):
            inside = False
            continue
        if inside and line.strip():
            collected.append(line)
    if last_line_only:
        return collected[-1:]
    return collected


def main_root():
    done = subprocess.run(
        ["git", "-C", cwd(), "rev-parse", "--path-format=absolute", "--git-common-dir"],
        capture_output=True, text=True)
    if done.returncode != 0:
        return None
    return os.path.dirname(done.stdout.strip())


def worktree_path(main, task):
    return os.path.join(os.path.dirname(main), "%s-%s" % (os.path.basename(main), slug(task)))


def branch_of(task):
    return "auto/%s" % slug(task)


def event():
    # Отказ разбора возвращается как None и не смешивается с пустым событием: у них разные исходы у сторожей.
    try:
        return json.loads(sys.stdin.read() or "{}")
    except ValueError:
        return None


def field(data, path, default=""):
    value = data
    for part in path.split("."):
        if not isinstance(value, dict):
            return default
        value = value.get(part)
    return value if isinstance(value, str) else default
