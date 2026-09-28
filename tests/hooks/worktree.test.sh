#!/usr/bin/env bash
# Регрессия изолированного дерева трека (issue #252): дерево-сосед, ветка auto/<TASK>, снятие без потери работы.
set -u
H="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts"
W="$H/worktree.py"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }

R="$T/repo"; mkdir -p "$R"
git -C "$R" init -q -b main; git -C "$R" config user.email t@t; git -C "$R" config user.name t
echo one > "$R/a.txt"; git -C "$R" add -A; git -C "$R" commit -qm first
base="$(git -C "$R" rev-parse HEAD)"
export DEX_AUTO_CWD="$R"

p="$("$W" path PROJ-1 2>/dev/null)"
check "$p" "$T/repo-PROJ-1" "path: дерево-сосед <repo>-<TASK>"
check "$(git -C "$p" rev-parse --abbrev-ref HEAD 2>/dev/null)" "auto/PROJ-1" "path: ветка auto/<TASK>"
check "$("$W" path PROJ-1 2>/dev/null)" "$p" "path: повторный вызов переиспользует дерево"
check "$(git -C "$R" worktree list | wc -l)" "2" "path: второго дерева на ту же задачу нет"

# Ключ ledger - каталог запуска: после EnterWorktree скрипты и хуки стартуют в дереве трека (ledger.md T2).
export CLAUDE_CONFIG_DIR="$T/cfg"; unset CLAUDE_PROJECT_DIR
L="$H/ledger.py"; key="$("$L" root)"
check "$(DEX_AUTO_CWD="$p" "$L" root)" "$key" "метка: из дерева трека ledger по каталогу запуска"
mkdir "$p/deep"; check "$(DEX_AUTO_CWD="$p/deep" "$L" root)" "$key" "метка: из подкаталога дерева тот же ключ"; rmdir "$p/deep"
check "$(DEX_AUTO_CWD="$p" "$W" path PROJ-1 2>/dev/null)" "$p" "метка: path из самого дерева - то же дерево"
check "$(DEX_AUTO_CWD="$p" "$L" root)" "$key" "метка: path из дерева не перезаписал каталог запуска деревом"
"$L" open PROJ-1 autonomous >/dev/null
check "$(printf '{"cwd":"%s","source":"startup"}' "$p" | CLAUDE_PROJECT_DIR="$p" "$H/session-start.py" | grep -c 'открытая цель PROJ-1')" "1" "метка: сессия, поднятая в дереве, находит цель"
mkdir "$R/sub"; p5="$(DEX_AUTO_CWD="$R/sub" "$W" path PROJ-5 2>/dev/null)"
check "$(DEX_AUTO_CWD="$p5" "$L" root)" "$(DEX_AUTO_CWD="$R/sub" "$L" root)" "метка: запуск из подкаталога - ключ этого подкаталога"
mkdir "$p/sm"; echo "gitdir: $T/sm-git" > "$p/sm/.git"
check "$(DEX_AUTO_CWD="$p/sm" "$L" root)" "$key" "метка: файл .git без метки внутри дерева (подмодуль) подъём не обрывает"
rm -f "$p/sm/.git"; rmdir "$p/sm"
echo "$T/gone" > "$(git -C "$p5" rev-parse --absolute-git-dir)/dex-auto-launch"
own="$T/cfg/projects/$(python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import dexauto; print(dexauto.slug(sys.argv[2]))' "$H" "$p5")/ledger"
check "$(DEX_AUTO_CWD="$p5" "$L" root)" "$own" "метка: каталог запуска исчез - ключ от своего каталога, не от мёртвой метки"
printf '\xff\n' > "$(git -C "$p5" rev-parse --absolute-git-dir)/dex-auto-launch"
check "$(DEX_AUTO_CWD="$p5" "$L" root 2>/dev/null)" "$own" "метка: байты не UTF-8 - ключ от своего каталога, скрипт не падает"
mkdir -p "$T/rel/decoy"; echo decoy > "$(git -C "$p5" rev-parse --absolute-git-dir)/dex-auto-launch"
check "$(cd "$T/rel" && DEX_AUTO_CWD="$p5" "$L" root)" "$own" "метка: относительный путь - ключ от своего каталога, не от каталога процесса"
check "$(cd "$T" && DEX_AUTO_CWD=repo "$L" root)" "$key" "ключ: каталог запуска относительным путём - тот же ключ, что абсолютным"
p6="$(cd "$T" && DEX_AUTO_CWD=repo "$W" path PROJ-6 2>/dev/null)"
check "$(DEX_AUTO_CWD="$p6" "$L" root)" "$key" "метка: сессия, запущенная относительным путём, - из дерева её ключ"
"$W" drop PROJ-6 >/dev/null 2>&1
git init -q "$p/inner"
inner="$T/cfg/projects/$(python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import dexauto; print(dexauto.slug(sys.argv[2]))' "$H" "$p/inner")/ledger"
check "$(DEX_AUTO_CWD="$p/inner" "$L" root)" "$inner" "метка: каталог .git внутри дерева обрывает подъём - свой репозиторий, свой ключ"
rm -rf "${p:?}/inner"

echo two > "$p/b.txt"; git -C "$p" add -A; git -C "$p" commit -qm "работа трека"
head="$(git -C "$p" rev-parse HEAD)"
"$W" drop PROJ-1 2>/dev/null; check "$?" "0" "drop: чистое дерево снимается"
check "$([ -d "$p" ] && echo есть || echo нет)" "нет" "drop: дерева на диске нет"
check "$(git -C "$R" rev-parse auto/PROJ-1 2>/dev/null)" "$head" "drop: ветка и коммиты трека остались"
check "$(git -C "$R" rev-parse HEAD)" "$base" "drop: основная ветка не тронута"

p2="$("$W" path PROJ-1 2>/dev/null)"
check "$p2" "$p" "path после drop: тот же путь"
check "$(git -C "$p2" rev-parse HEAD)" "$head" "path после drop: дерево поднято от ветки, работа на месте"

echo три > "$p2/c.txt"
"$W" drop PROJ-1 >/dev/null 2>&1; check "$?" "1" "drop: грязное дерево не снимается"
check "$([ -d "$p2" ] && echo есть || echo нет)" "есть" "drop: грязное дерево цело"
rm -f "$p2/c.txt"; "$W" drop PROJ-1 >/dev/null 2>&1
mkdir "$T/repo-PROJ-8"; echo x > "$T/repo-PROJ-8/keep.txt"
msg="$(LC_ALL=C "$W" drop PROJ-8 2>&1)"; check "$?" "1" "drop: путь не дерева трека - ненулевой код"
check "$(printf '%s' "$msg" | grep -c 'не деревом трека')" "1" "drop: отказ на чужом пути называет эту причину, а не незакоммиченное"
check "$([ -f "$T/repo-PROJ-8/keep.txt" ] && echo есть || echo нет)" "есть" "drop: чужой путь не тронут"

p3="$("$W" path PROJ-2 --detach 2>/dev/null)"
check "$(git -C "$p3" rev-parse --abbrev-ref HEAD 2>/dev/null)" "HEAD" "path --detach: дерево в detached HEAD"
check "$(git -C "$R" show-ref --verify --quiet refs/heads/auto/PROJ-2; echo $?)" "1" "path --detach: ветки не заводит"

rm -rf "$p3"
p4="$("$W" path PROJ-2 --detach 2>/dev/null)"; rc=$?
check "$rc" "0" "path: снятое руками дерево не блокирует (prune)"
check "$p4" "$p3" "path: путь тот же"

check "$("$W" where PROJ-7)" "$(dirname "$R")/$(basename "$R")-PROJ-7" "where: путь несуществующего дерева, ничего не создавая"
check "$([ -e "$(dirname "$R")/$(basename "$R")-PROJ-7" ] && echo есть || echo нет)" "нет" "where: дерева не завёл"
check "$("$W" main)" "$R" "main: корень дерева сессии"
check "$(cd "$p4" && DEX_AUTO_CWD="$p4" "$W" main)" "$R" "main: из дерева трека тот же корень"
git -C "$R" worktree add -q "$T/own" -b own 2>/dev/null
check "$(DEX_AUTO_CWD="$T/own" "$W" main)" "$T/own" "main: сессия в своём worktree - корень её дерева, не основной копии"
git init -q "$T/lib"; git -C "$T/lib" -c user.email=t@t -c user.name=t commit -q --allow-empty -m lib
git -C "$R" -c protocol.file.allow=always submodule add -q "$T/lib" lib >/dev/null 2>&1
check "$(DEX_AUTO_CWD="$R/lib" "$W" main)" "$R/lib" "main: сессия в подмодуле - корень подмодуля, не .git суперпроекта"
check "$(DEX_AUTO_CWD="$R/lib" "$W" where PROJ-3)" "$T/repo-lib-PROJ-3" "where: дерево подмодуля - сосед внешнего суперпроекта, не внутри него"
check "$(DEX_AUTO_CWD="$R/lib" "$W" path PROJ-3 2>/dev/null)" "$T/repo-lib-PROJ-3" "path: дерево подмодуля заведено соседом суперпроекта"
check "$(git -C "$T/repo-lib-PROJ-3" rev-parse --abbrev-ref HEAD 2>/dev/null)" "auto/PROJ-3" "path: дерево подмодуля на ветке auto/<TASK>"
git -C "$R" commit -qm lib
ps="$("$W" path PROJ-4 2>/dev/null)"; git -C "$ps" -c protocol.file.allow=always submodule update --init -q >/dev/null 2>&1
msg="$(LC_ALL=C "$W" drop PROJ-4 2>&1)"; check "$?" "1" "drop: дерево с поднятым подмодулем не снимается"
check "$(printf '%s' "$msg" | grep -c 'submodules')$(printf '%s' "$msg" | grep -c 'незакоммиченные')" "10" "drop: отказ называет причину git, а не незакоммиченное"
check "$(git -C "$ps/lib" rev-parse HEAD 2>/dev/null)" "$(git -C "$T/lib" rev-parse HEAD)" "drop: подмодуль дерева цел"

F="$T/foreign"; git init -q -b main "$F"; git -C "$F" -c user.email=t@t -c user.name=t commit -q --allow-empty -m f
msg="$(GIT_DIR="$F/.git" "$W" path PROJ-10 2>&1)"; check "$?" "1" "path: GIT_DIR в окружении - ненулевой код"
check "$(printf '%s' "$msg" | grep -c 'GIT_DIR')" "1" "path: отказ называет переменную"
check "$(git -C "$F" worktree list | wc -l)$(git -C "$F" branch --list 'auto/*' | wc -l)$(ls -d "$T"/*-PROJ-10 2>/dev/null | wc -l)" "100" "path: GIT_DIR - ни дерева, ни ветки нигде"
for v in GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_INDEX_FILE GIT_OBJECT_DIRECTORY; do
  for val in "$F/.git" ""; do
    msg="$(env "$v=$val" "$W" main 2>&1)"; check "$?:$(printf '%s' "$msg" | grep -c "уводит git ($v)")" "1:1" "main: $v=${val:-пусто} - отказ с именем переменной"
  done
done

export DEX_AUTO_CWD="$T"
"$W" path PROJ-9 >/dev/null 2>&1; check "$?" "1" "path: вне git-репозитория - ненулевой код"
check "$([ -e "$T/$(basename "$T")-PROJ-9" ] && echo есть || echo нет)" "нет" "path: вне git ничего не создано"
"$W" where PROJ-9 >/dev/null 2>&1; check "$?" "1" "where: вне git-репозитория - ненулевой код"
"$W" main >/dev/null 2>&1; check "$?" "1" "main: вне git-репозитория - ненулевой код"

[ "$fail" = 0 ] && echo "worktree.test.sh: $n проверок, все прошли" || { echo "worktree.test.sh: есть провалы"; exit 1; }
