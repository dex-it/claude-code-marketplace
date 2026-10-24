#!/usr/bin/env bash
# setup.sh <каталог>: заготовка плеча с базовым коммитом; оракул в дерево не попадает.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
dest=${1:-}
[ -n "$dest" ] || { printf 'использование: %s <каталог>\n' "$0" >&2; exit 2; }
[ -e "$dest" ] && { printf 'каталог занят: %s\n' "$dest" >&2; exit 2; }
# Плечо внутри репозитория дотягивается чтением до оракула и reference.md.
top=$(git -C "$here" rev-parse --show-toplevel)
mkdir -p "$dest"
case "$(cd "$dest" && pwd)/" in "$top"/*) rmdir "$dest"; printf 'каталог внутри репозитория: %s\n' "$dest" >&2; exit 2 ;; esac

cp -r "$here/repo/." "$dest/"
git -C "$dest" init -q -b main
git -C "$dest" add -A
git -C "$dest" -c user.name=probe -c user.email=probe@local commit -q -m 'baseline fixture: задание'
printf 'дерево: %s\n' "$(cd "$dest" && pwd)"
