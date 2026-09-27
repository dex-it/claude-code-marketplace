#!/usr/bin/env python3
# Дерево трека изолируется, потому что чужая незакоммиченная работа в общем дереве заворачивала верификацию (issue #252).
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

USAGE = "usage: worktree.py path TASK [--detach]|where TASK|main|drop TASK"
REDIRECTS = ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY")


def die(message, code=64):
    sys.stderr.write(message + "\n")
    sys.exit(code)


def git(main, *args, **kwargs):
    return subprocess.run(["git", "-C", main] + list(args), text=True, **kwargs)


def need_main():
    leak = [name for name in REDIRECTS if name in os.environ]
    if leak:
        # Сброс здесь не спасает: git узлов наследует окружение сессии, и коммиты трека ушли бы мимо его ветки (P40).
        die("worktree.py: окружение сессии уводит git (%s) - дерево трека не изолировать; сними переменные и перезапусти сессию" % ", ".join(leak), 1)
    main = dx.main_root()
    if main is None:
        die("worktree.py: %s не в git-репозитории - изолированное дерево завести негде" % dx.cwd(), 1)
    return main


def need_task(args):
    if not args or not args[0]:
        die("worktree.py: нужен TASK")
    return args[0]


def is_tree(main, path):
    listing = git(main, "worktree", "list", "--porcelain", capture_output=True)
    if listing.returncode != 0:
        die("worktree.py: перечень деревьев %s не прочитан: %s" % (main, listing.stderr.strip()), 1)
    return ("worktree %s" % path) in listing.stdout.split("\n")


def cmd_path(args):
    task = need_task(args)
    detach = len(args) > 1 and args[1] == "--detach"
    main = need_main()
    path = dx.worktree_path(dx.tree_base(main), task)
    branch = dx.branch_of(task)
    # Снятое руками дерево оставляет запись в .git/worktrees и блокирует повторное заведение по тому же пути.
    git(main, "worktree", "prune")
    if is_tree(main, path):
        mark_launch(path)
        print(path)
        return
    if os.path.exists(path):
        die("worktree.py: путь %s занят не деревом трека" % path, 1)
    if detach:
        git(main, "worktree", "add", "--detach", path, "HEAD", stdout=sys.stderr)
    elif git(main, "show-ref", "--verify", "--quiet", "refs/heads/%s" % branch).returncode == 0:
        # Ветка пережила снятое дерево: коммиты прошлого прогона на месте, дерево поднимается от неё.
        git(main, "worktree", "add", path, branch, stdout=sys.stderr)
    else:
        git(main, "worktree", "add", "-b", branch, path, "HEAD", stdout=sys.stderr)
    mark_launch(path)
    print(path)


def mark_launch(path):
    gitdir = git(path, "rev-parse", "--absolute-git-dir", capture_output=True) if os.path.isdir(path) else None
    if gitdir is None or gitdir.returncode != 0:
        die("worktree.py: дерево %s не заведено" % path, 1)
    mark = os.path.join(gitdir.stdout.strip(), dx.LAUNCH_MARK)
    # Через замену: хук, читающий метку в этот момент, не видит её пустой.
    with open(mark + ".tmp", "w", encoding="utf-8") as f:
        f.write(dx.cwd() + "\n")
    os.replace(mark + ".tmp", mark)


def cmd_drop(args):
    task = need_task(args)
    main = need_main()
    path = dx.worktree_path(dx.tree_base(main), task)
    if not os.path.isdir(path):
        return
    if not is_tree(main, path):
        die("worktree.py: путь %s занят не деревом трека - не снимается" % path, 1)
    # Без --force: он сносит незакоммиченное и git-каталоги подмодулей дерева вместе с их коммитами.
    done = git(main, "worktree", "remove", path, capture_output=True)
    if done.returncode != 0:
        die("worktree.py: дерево %s не снято: %s; работа трека цела" % (path, done.stderr.strip()), 1)


def main(argv):
    if not argv:
        die(USAGE)
    cmd, args = argv[0], argv[1:]
    if cmd == "path":
        cmd_path(args)
    elif cmd == "where":
        print(dx.worktree_path(dx.tree_base(need_main()), need_task(args)))
    elif cmd == "main":
        print(need_main())
    elif cmd == "drop":
        cmd_drop(args)
    else:
        die(USAGE)


if __name__ == "__main__":
    main(sys.argv[1:])
