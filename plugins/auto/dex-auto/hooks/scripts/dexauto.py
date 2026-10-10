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


LAUNCH_MARK = "dex-auto-launch"


def cwd():
    base = os.path.abspath(os.environ.get("DEX_AUTO_CWD") or os.getcwd())
    return launch_of(base) or base


def launch_of(path):
    # Ключ ledger - каталог запуска, а после EnterWorktree процесс в дереве трека; git не вызывается (ledger.md T2).
    here = os.path.abspath(path)
    while not os.path.isdir(os.path.join(here, ".git")):
        launch = read_mark(os.path.join(here, ".git"))
        if launch:
            return launch
        up = os.path.dirname(here)
        if up == here:
            return None
        here = up
    return None


def read_mark(dotgit):
    try:
        with open(dotgit, encoding="utf-8") as f:
            head = f.readline().strip()
        if not head.startswith("gitdir:"):
            return None
        with open(os.path.join(os.path.dirname(dotgit), head[len("gitdir:"):].strip(), LAUNCH_MARK), encoding="utf-8") as f:
            launch = f.read().strip()
    except (OSError, ValueError):
        return None
    # Мёртвая метка (репозиторий перенесён) увела бы ключ в несуществующий каталог, относительная - от каталога процесса.
    return launch if os.path.isabs(launch) and os.path.isdir(launch) else None


def bind_session(data):
    # Ключ ledger - каталог запуска сессии (ADR-0001): cwd события после EnterWorktree - дерево трека (P35).
    os.environ["DEX_AUTO_CWD"] = os.environ.get("CLAUDE_PROJECT_DIR") or field(data or {}, "cwd") or os.getcwd()


def slug(text):
    return SLUG_BAD.sub("-", text)


def root():
    return os.path.join(config_dir(), "projects", slug(cwd()), "ledger")


def task_dir(task):
    return os.path.join(root(), slug(task))


def goal_file(task):
    return os.path.join(task_dir(task), "00-goal.md")


def owner_file(task):
    return os.path.join(task_dir(task), "owner")


def owner(task):
    try:
        return lines_of(owner_file(task))[0].strip()
    except OSError:
        return ""


def claim(task):
    # Владелец - сессия процесса записи (ledger.md T4); переменная не задокументирована, зонд P100.
    session = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
    try:
        if not session:
            raise OSError("CLAUDE_CODE_SESSION_ID нет в окружении")
        write_lines(owner_file(task), [session])
    except OSError as err:
        sys.stderr.write("dex-auto: владелец цели %s не записан, сторож Stop держит прежнего либо никого - %s\n" % (task, err))


def track_file(task, track):
    base = track[:-len("-delta")] if track.endswith("-delta") else track
    return os.path.join(task_dir(task), "01-%s.md" % base)


# Статусы находки, при которых она остаётся в разности «открытые»: unverified - claim без суда скептика.
OPEN_FINDING = ("open", "partial", "unverified")


def findings_file(task, track):
    return track_file(task, track)[:-len(".md")] + ".findings.jsonl"


# Строка раздела «### Открытые находки» до реестра: `- [severity] anchor: text`, у подтверждённой - с `(закрытие: ...)`.
LEGACY_LINE = re.compile(r"^- \[([^\]]*)\] (.+?): (.*?)(?: \(закрытие: (.*)\))?$")


def legacy_findings(track_path):
    # Цель, начатая до реестра: открытые - раздел последнего прогона файла трека, id выдаются по порядку.
    # Без этого «продолжить» после обновления получал пустую разность и выпускал трек мимо прежней P0/P1.
    found = []
    inside = False
    if not os.path.isfile(track_path):
        return {}
    for line in lines_of(track_path):
        if line.startswith("## Прогон "):
            found, inside = [], False
        elif line.startswith("#"):
            inside = line.startswith("### Открытые находки")
        elif inside and LEGACY_LINE.match(line):
            sev, anchor, body, closure = LEGACY_LINE.match(line).groups()
            found.append({"anchor": anchor, "severity": sev, "text": body, "closure": closure or "", "status": "open"})
    return {"F%d" % i: dict(rec, id="F%d" % i, run=0) for i, rec in enumerate(found, 1)}


def findings_state(path, legacy_track=None):
    # Реестр append-only: состояние находки - её последняя запись, порядок - порядок заведения.
    state = {}
    if not os.path.isfile(path):
        return legacy_findings(legacy_track) if legacy_track else state
    for line in lines_of(path):
        try:
            rec = json.loads(line) if line.strip() else None
        except ValueError:
            raise ValueError("реестр находок %s: строка не JSON - %s" % (path, line[:80]))
        if isinstance(rec, dict) and isinstance(rec.get("id"), str):
            state[rec["id"]] = rec
    return state


def open_findings(path, legacy_track=None):
    return [r for r in findings_state(path, legacy_track).values() if r.get("status") in OPEN_FINDING]


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


def section(path, title, last_line_only=False):
    if not os.path.isfile(path):
        return []
    collected = []
    inside = False
    for line in lines_of(path):
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
    # Дерево сессии, а не родитель --git-common-dir: в подмодуле это .git суперпроекта, в своём worktree - чужая копия.
    done = subprocess.run(["git", "-C", cwd(), "rev-parse", "--show-toplevel"], capture_output=True, text=True)
    if done.returncode != 0:
        return None
    return done.stdout.strip()


def tree_base(main):
    # Подмодуль - сосед внешнего суперпроекта: внутри суперпроекта копия ложится в его рабочее дерево непрослеженной.
    outer = main
    while True:
        up = subprocess.run(["git", "-C", outer, "rev-parse", "--show-superproject-working-tree"], capture_output=True, text=True)
        if up.returncode != 0 or not up.stdout.strip():
            break
        outer = up.stdout.strip()
    return os.path.join(os.path.dirname(outer), os.path.relpath(main, os.path.dirname(outer)).replace(os.sep, "-"))


def worktree_path(base, task):
    return "%s-%s" % (base, slug(task))


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
