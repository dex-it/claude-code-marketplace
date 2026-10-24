#!/usr/bin/env bash
# Контракт verify.py: поля выхода трек судит как есть, поэтому каждое поле проверяется на живом репозитории и раннере.
set -u
V="$(cd "$(dirname "$0")/../.." && pwd)/plugins/auto/dex-auto/hooks/scripts/verify.py"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fail=0; n=0
check() { n=$((n+1)); if [ "$1" = "$2" ]; then echo "ok $n - $3"; else echo "FAIL $n - $3: ожидалось [$2], получено [$1]"; fail=1; fi; }
hx() { python3 -c 'import sys; print(sys.argv[1].encode().hex())' "$1"; }
run() { (cd "$R" && "$V" "$(hx "$1")"); }
field() { python3 -c 'import sys, json; v = json.load(sys.stdin)[sys.argv[1]]; print(json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v)' "$1"; }

R="$T/repo"; mkdir -p "$R"
git -C "$R" init -q -b main; git -C "$R" config user.email t@t; git -C "$R" config user.name t
cat > "$R/ok.test.mjs" <<'EOF'
import test from 'node:test'
test('a', () => {})
test('b', () => {})
EOF
cat > "$R/flip.test.mjs" <<'EOF'
import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, writeFileSync } from 'node:fs'
const f = process.env.FLIP
const k = Number(readFileSync(f, 'utf8') || 0) + 1
writeFileSync(f, String(k))
test('flip', () => assert.ok(process.env.MODE === 'stable-red' ? false : k > 1))
EOF
echo '.runs' > "$R/.gitignore"
git -C "$R" add -A; git -C "$R" commit -qm first
git -C "$R" checkout -qb auto/T1
NODE_JUNIT='node --test --test-reporter=junit --test-reporter-destination=$DEX_AUTO_JUNIT_DIR/r.xml'

out="$(run "{\"build\": \"true\", \"test\": \"$NODE_JUNIT ok.test.mjs\"}")"
check "$(echo "$out" | field exit_code)/$(echo "$out" | field build_ok)/$(echo "$out" | field pass_count)/$(echo "$out" | field fail_count)" "0/true/2/0" "зелёный: код 0, сборка ok, прошло 2, упало 0"
check "$(echo "$out" | field counts)" "report" "зелёный: счётчики из отчёта раннера"
check "$(echo "$out" | field dirty)/$(echo "$out" | field ahead)" "false/0" "отчёт раннера лёг вне дерева: дерево чистое, коммитов трека нет"
check "$(echo "$out" | field head_sha)" "$(git -C "$R" rev-parse HEAD)" "head_sha - полный sha HEAD"

out="$(run '{"build": "echo boom; exit 3", "test": "echo never > ran.txt"}')"
check "$(echo "$out" | field build_ok)/$(echo "$out" | field exit_code)/$(echo "$out" | field failing)" 'false/3/["<build>"]' "сборка упала: build_ok по коду сборки, падение - <build>"
check "$(echo "$out" | field build_tail)" "boom" "сборка упала: хвост её вывода в build_tail"
check "$([ -e "$R/ran.txt" ] && echo ran || echo skipped)" "skipped" "сборка упала: тесты не гонялись"

mkdir -p "$R/.runs"
: > "$R/.runs/n"
out="$(FLIP="$R/.runs/n" MODE=stable-red run "{\"test\": \"$NODE_JUNIT flip.test.mjs\", \"known\": [\"test.flip\"]}")"
check "$(cat "$R/.runs/n")/$(echo "$out" | field failing)" '1/["test.flip"]' "унаследованное падение: повтора нет, имя в failing"

: > "$R/.runs/n"
out="$(FLIP="$R/.runs/n" MODE=stable-red run "{\"test\": \"$NODE_JUNIT flip.test.mjs\"}")"
check "$(cat "$R/.runs/n")/$(echo "$out" | field failing)/$(echo "$out" | field flaky)" '2/["test.flip"]/[]' "новое стабильное падение: один повтор, остаётся в failing"

: > "$R/.runs/n"
out="$(FLIP="$R/.runs/n" run "{\"test\": \"$NODE_JUNIT flip.test.mjs\"}")"
check "$(echo "$out" | field failing)/$(echo "$out" | field flaky)/$(echo "$out" | field exit_code)" '[]/["test.flip"]/0' "нестабильный: красный, затем зелёный - flaky, итог по повтору"

out="$(run '{"build": "true", "test": "echo 3 passing"}')"
check "$(echo "$out" | field counts)/$(echo "$out" | field pass_count)/$(echo "$out" | field test_tail)" "null/null/3 passing" "раннер без отчёта: счётчики null, хвост лога для разбора"

cat > "$R/.runs/r.trx" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Results>
<UnitTestResult testName="Ns.A.Ok" outcome="Passed" /><UnitTestResult testName="Ns.A.Bad" outcome="Failed" />
</Results></TestRun>
EOF
out="$(run '{"test": "cp .runs/r.trx \"$DEX_AUTO_JUNIT_DIR/\"; exit 1"}')"
check "$(echo "$out" | field pass_count)/$(echo "$out" | field failing)" '1/["Ns.A.Bad"]' "TRX dotnet test: имена и счётчики разобраны"
out="$(run '{"test": "cp .runs/r.trx \"$DEX_AUTO_JUNIT_DIR/a.trx\"; cp .runs/r.trx \"$DEX_AUTO_JUNIT_DIR/b.trx\"; exit 1", "known": ["Ns.A.Bad"]}')"
check "$(echo "$out" | field fail_count)/$(echo "$out" | field failing)" '1/["Ns.A.Bad"]' "одно имя в двух отчётах (два target framework) - одно падение"

cat > "$R/.runs/abort.trx" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><ResultSummary outcome="Failed"><RunInfos>
<RunInfo computerName="m" outcome="Error" timestamp="2026-10-16T00:00:00"><Text>The active test run was aborted. Reason: Test host process crashed : Process terminated.</Text></RunInfo>
</RunInfos></ResultSummary></TestRun>
XML
out="$(run '{"test": "cp .runs/r.trx \"$DEX_AUTO_JUNIT_DIR/a.trx\"; cp .runs/abort.trx \"$DEX_AUTO_JUNIT_DIR/b.trx\"; exit 1", "known": ["Ns.A.Bad"]}')"
check "$(echo "$out" | field failing)" '["<aborted>", "Ns.A.Bad"]' "тест-хост упал: прерванный прогон - падение <aborted>, унаследованным не считается"

: > "$R/.runs/n"
out="$(FLIP="$R/.runs/n" MODE=stable-red DEX_AUTO_FLAKY_MAX=0 run "{\"test\": \"$NODE_JUNIT flip.test.mjs\"}")"
check "$(cat "$R/.runs/n")/$(echo "$out" | field failing)" '1/["test.flip"]' "новых красных больше потолка повтора: повтора нет"

out="$(run '{"test": "echo art > art.txt"}')"
check "$(echo "$out" | field dirty)" "false" "dirty снят до прогона: файл, созданный тестами, правкой не считается"
rm -f "$R/art.txt"

out="$(cd "$R" && DEX_AUTO_VERIFY_LIMIT=1 "$V" "$(hx '{"test": "sleep 37 & sleep 37; wait"}')")"
sleep 0.5
check "$(echo "$out" | field status)/$(pgrep -f 'sleep 37' | wc -l | tr -d ' ')" "blocked/0" "потолок прогона: blocked, команда и её фоновые процессы убиты"

echo x > "$R/note.txt"; git -C "$R" add note.txt; git -C "$R" commit -qm feat; echo y > "$R/new.txt"
out="$(run '{"build": "true"}')"
check "$(echo "$out" | field dirty)/$(echo "$out" | field ahead)/$(echo "$out" | field exit_code)" "true/1/0" "дерево: неотслеживаемый файл - dirty, коммит ветки - ahead; без тестов код по сборке"
rm -f "$R/new.txt"

blob="$(printf 'snapshot\n' | git -C "$R" hash-object -w --stdin)"
out="$(run "{\"test\": \"cat ok.test.mjs > .runs/seen\", \"snap\": {\"blob\": \"$blob\", \"path\": \"ok.test.mjs\"}, \"hash_path\": \"ok.test.mjs\"}")"
check "$(echo "$out" | field snap_hash)" "$blob" "снимок: файл поставлен из blob до прогона"
check "$(cat "$R/.runs/seen")" "snapshot" "снимок: тесты гонялись на снимке"
check "$(echo "$out" | field repro_test_hash)" "$(git -C "$R" hash-object ok.test.mjs)" "снимок: файл возвращён, repro_test_hash - хэш возвращённого"
check "$(echo "$out" | field dirty)" "false" "снимок: после возврата дерево чистое"
out="$(run '{"hash_path": "gone.test.mjs"}')"
check "$(echo "$out" | field repro_test_hash)" "missing" "хэш: файла нет - missing"

out="$(cd "$R" && DEX_AUTO_VERIFY_WAIT=0 "$V" "$(hx '{"test": "sleep 2; echo late"}')")"
check "$(echo "$out" | field status)" "running" "ожидание исчерпано до конца прогона - running с путём отчёта"
out="$("$V" --wait "$(echo "$out" | field out)")"
check "$(echo "$out" | field status)/$(echo "$out" | field test_tail)" "complete/late" "--wait дождался отчёта отсоединённого прогона"

out="$(cd "$R" && DEX_AUTO_VERIFY_WAIT=0 "$V" "$(hx '{"test": "sleep 30"}')")"
o="$(echo "$out" | field out)"; sid="$(cat "$(dirname "$o")/pid")"
# pid из файла - лидер группы (прогон стартует в новой сессии): -g и отрицательный pid есть и в GNU, и в BSD.
for _ in $(seq 50); do pgrep -g "$sid" -x sleep >/dev/null && break; sleep 0.1; done
kill -9 -- "-$sid"; sleep 0.5
check "$("$V" --wait "$o" | field status)" "blocked" "прогон убит до отчёта - blocked, а не вечное ожидание"

has() { python3 -c 'import sys, json; print(sys.argv[1] in json.load(sys.stdin))' "$1"; }
printf 'a\nb\nc\n' > "$R/three.txt"; git -C "$R" add three.txt; git -C "$R" commit -qm three
base="$(git -C "$R" rev-parse HEAD)"
printf 'a\nB\nc\nd\n' > "$R/three.txt"; git -C "$R" rm -q note.txt; git -C "$R" commit -qam delta; echo z > "$R/fresh.txt"
out="$(run "{\"delta_from\": \"$base\"}")"
check "$(echo "$out" | field delta)" '["note.txt", "three.txt:2-2", "three.txt:4-4", "fresh.txt"]' "дельта: удалённый файл, изменённая и добавленная строка, неотслеживаемый файл"
check "$(run '{"delta_from": "nosuchsha"}' | has delta)/$(run '{}' | has delta)" "False/False" "дельта: база не разобрана либо не подана - поля нет"
rm -f "$R/fresh.txt"
base="$(git -C "$R" rev-parse HEAD)"
printf '++ b/x\nB\nc\nD\n' > "$R/three.txt"; printf 'q\n' > "$R/s p.txt"; git -C "$R" add -A; git -C "$R" commit -qm tricky
check "$(run "{\"delta_from\": \"$base\"}" | field delta)" '["s p.txt:1-1", "three.txt:1-1", "three.txt:4-4"]' "дельта: строка «++ b/x» хунка - не заголовок файла, путь с пробелом без TAB"

(cd "$R" && "$V" zz >/dev/null 2>&1); check "$?" "64" "вход не hex от JSON - код 64"

H="$T/hrepo"; mkdir -p "$H"
git -C "$H" init -q -b main; git -C "$H" config user.email t@t; git -C "$H" config user.name t
printf 'a\nb\nc\n' > "$H/x.txt"; git -C "$H" add -A; git -C "$H" commit -qm base
git -C "$H" checkout -qb auto/T2
printf 'a\nB\nc\nd\n' > "$H/x.txt"; git -C "$H" commit -qam own
hk() { (cd "$H" && "$V" --hunks "$@"); }
check "$(hk | field hunks)" '["x.txt:2-2", "x.txt:4-4"]' "--hunks без базы: места от родителя первого своего коммита"
check "$(hk | field base)" "$(git -C "$H" rev-parse auto/T2)^" "--hunks без базы: база названа"
check "$(hk "$(git -C "$H" rev-parse auto/T2)" | field hunks)" '[]' "--hunks: база - предок HEAD, берётся как есть"
check "$(hk nosuchsha | field base)" "$(git -C "$H" rev-parse auto/T2)^" "--hunks: база не предок HEAD - как без базы"
git -C "$H" checkout -q main; printf 'z\n' >> "$H/x.txt"
check "$(hk | field hunks)/$(hk | field base)" '["x.txt:4-4"]/HEAD' "--hunks: своих коммитов нет - незакоммиченное от HEAD"
printf '\000\001' > "$H/b.bin"; printf 'y\n' > "$H/y.txt"; git -C "$H" add b.bin y.txt; git -C "$H" commit -qm bin; git -C "$H" branch bin-seen
printf '\000\002' > "$H/b.bin"; git -C "$H" mv y.txt z.txt
check "$(hk | field hunks)" '["x.txt:4-4", "y.txt", "b.bin", "z.txt"]' "--hunks: бинарный файл и чистое переименование - место правки целиком, старый путь - как удалённый файл"

mkdir -p "$T/keep"; echo '{"status": "complete"}' > "$T/keep/out.json"
"$V" --wait "$T/keep/out.json" >/dev/null
check "$([ -d "$T/keep" ] && echo kept || echo removed)" "kept" "--wait удаляет только свой каталог dex-auto-verify-*"

exit $fail
