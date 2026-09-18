#!/usr/bin/env bash
# Изолированное рабочее дерево трека: трек правит, собирает и коммитит только в нём (issue #252).
# Общее дерево сессии треку не отдаётся - чужая незакоммиченная работа заворачивала верификацию,
# а коммиты цели ложились на ветку, которую в ту же минуту забирала соседняя сессия.
# Ledger живёт по другой формуле (<config>/projects/<slug>/ledger) и от этого дерева не зависит:
# ledger.sh и finish.sh зовутся из каталога сессии, иначе <slug> уедет вместе с cwd.
set -eu

CWD="${DEX_AUTO_CWD:-$PWD}"
slug() { printf '%s' "$1" | sed 's/[^A-Za-z0-9-]/-/g'; }

# Корень основной рабочей копии, а не текущей: --git-common-dir из любого worktree ведёт в общий
# .git, поэтому дерево-сосед заводится рядом с главной копией и при запуске из другого worktree.
main_root() {
  local gd
  gd="$(git -C "$CWD" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || {
    echo "worktree.sh: $CWD не в git-репозитории - изолированное дерево завести негде" >&2; return 1; }
  dirname "$gd"
}
wt_path() { printf '%s/%s-%s' "$(dirname "$1")" "$(basename "$1")" "$(slug "$2")"; }
branch_of() { printf 'auto/%s' "$(slug "$1")"; }

cmd=${1:-}; shift || true
case "$cmd" in
  path) # path TASK [--detach] -> путь дерева; существующее переиспользуется (возобновление трека)
    task=${1:-}; [ -n "$task" ] || { echo "worktree.sh: нужен TASK" >&2; exit 64; }
    detach=${2:-}; main="$(main_root)"; p="$(wt_path "$main" "$task")"; b="$(branch_of "$task")"
    # Снятое руками дерево оставляет запись в .git/worktrees и блокирует повторное заведение по тому
    # же пути; prune чистит только записи без дерева на диске, живые не трогает.
    git -C "$main" worktree prune
    if git -C "$main" worktree list --porcelain | grep -qx "worktree $p"; then printf '%s\n' "$p"; exit 0; fi
    [ -e "$p" ] && { echo "worktree.sh: путь $p занят не деревом трека" >&2; exit 1; }
    if [ "$detach" = "--detach" ]; then
      git -C "$main" worktree add --detach "$p" HEAD >&2
    elif git -C "$main" show-ref --verify --quiet "refs/heads/$b"; then
      # Ветка пережила снятое дерево: коммиты прошлого прогона на месте, дерево поднимается от неё.
      git -C "$main" worktree add "$p" "$b" >&2
    else
      git -C "$main" worktree add -b "$b" "$p" HEAD >&2
    fi
    printf '%s\n' "$p" ;;
  drop) # drop TASK -> снять дерево; ветка и коммиты остаются в общем .git
    task=${1:-}; [ -n "$task" ] || { echo "worktree.sh: нужен TASK" >&2; exit 64; }
    main="$(main_root)"; p="$(wt_path "$main" "$task")"
    [ -d "$p" ] || exit 0
    # Без --force: незакоммиченное в дереве - незакрытый хвост трека, и снос его прячет.
    git -C "$main" worktree remove "$p" >&2 || {
      echo "worktree.sh: дерево $p не снято (незакоммиченные изменения); работа трека цела" >&2; exit 1; }
    ;;
  *) echo "usage: worktree.sh path TASK [--detach]|drop TASK" >&2; exit 64 ;;
esac
