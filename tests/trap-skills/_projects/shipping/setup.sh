#!/usr/bin/env bash
# Разворачивает репозиторий сервиса shipping с детерминированной историей из history/NNN-*/
# (формат - README мини-проекта, раздел «История»). Повторный запуск в другой каталог даёт те же SHA;
# итог сверяется с refs.json, расхождение - код 1.
# Использование: setup.sh <dest> [ref для checkout, по умолчанию develop]
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
[ $# -ge 1 ] || { echo "usage: setup.sh <dest> [ref]" >&2; exit 2; }
exec node "$here/setup.mjs" "$@"
