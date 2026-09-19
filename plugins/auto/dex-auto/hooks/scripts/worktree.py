#!/usr/bin/env python3
# Дерево трека изолируется, потому что чужая незакоммиченная работа в общем дереве заворачивала верификацию (issue #252).
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dexauto as dx

USAGE = "usage: worktree.py path TASK [--detach]|where TASK|main|drop TASK"


def die(message, code=64):
    sys.stderr.write(message + "\n")
    sys.exit(code)


def git(main, *args, **kwargs):
    return subprocess.run(["git", "-C", main] + list(args), text=True, **kwargs)


def need_main():
    main = dx.main_root()
    if main is None:
        die("worktree.py: %s не в git-репозитории - изолированное дерево завести негде" % dx.cwd(), 1)
    return main


def need_task(args):
    if not args or not args[0]:
        die("worktree.py: нужен TASK")
    return args[0]


def cmd_path(args):
    task = need_task(args)
    detach = len(args) > 1 and args[1] == "--detach"
    main = need_main()
    path = dx.worktree_path(main, task)
    branch = dx.branch_of(task)
    # Снятое руками дерево оставляет запись в .git/worktrees и блокирует повторное заведение по тому же пути.
    git(main, "worktree", "prune")
    listing = git(main, "worktree", "list", "--porcelain", capture_output=True)
    if ("worktree %s" % path) in listing.stdout.split("\n"):
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
    print(path)


def cmd_drop(args):
    task = need_task(args)
    main = need_main()
    path = dx.worktree_path(main, task)
    if not os.path.isdir(path):
        return
    # Без --force: незакоммиченное в дереве - незакрытый хвост трека, и снос его прячет.
    if git(main, "worktree", "remove", path, stdout=sys.stderr).returncode != 0:
        die("worktree.py: дерево %s не снято (незакоммиченные изменения); работа трека цела" % path, 1)


def main(argv):
    if not argv:
        die(USAGE)
    cmd, args = argv[0], argv[1:]
    if cmd == "path":
        cmd_path(args)
    elif cmd == "where":
        print(dx.worktree_path(need_main(), need_task(args)))
    elif cmd == "main":
        print(need_main())
    elif cmd == "drop":
        cmd_drop(args)
    else:
        die(USAGE)


if __name__ == "__main__":
    main(sys.argv[1:])
