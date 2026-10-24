#!/bin/bash
# Сборка артефактов лаборатории внутри образа diag46-lab: build.sh <каталог-исходников> <каталог-выхода>. Без сети.
set -euo pipefail
S0=${1:?src}; O=${2:?out}
S=/tmp/src; rm -rf $S; cp -r "$S0" $S
find "$O" -mindepth 1 -delete 2>/dev/null; mkdir -p "$O"/{app,native,vendor,symbols}
export DOTNET_CLI_HOME=/tmp/dotnethome
dotnet publish "$S/orders-worker" -c Release -o "$O/app" --nologo -v q
dotnet build "$S/dotnet-vendor" -c Release -o "$O/vendor" --nologo -v q
rm -f "$O"/vendor/*.deps.json "$O"/vendor/*.pdb
N="$S/native"
# crashme: prod (strip) + debug-файлы двух сборок недели
gcc -O2 -fPIE -pie -g -o /tmp/crash_new "$N/crashme.c"
gcc -O2 -fPIE -pie -g -o /tmp/crash_old "$N/crashme_old.c"
objcopy --only-keep-debug /tmp/crash_new "$O/symbols/build-0419.debug"
objcopy --only-keep-debug /tmp/crash_old "$O/symbols/build-0412.debug"
cp /tmp/crash_new "$O/native/crashme"; strip --strip-all "$O/native/crashme"
# stockd: -O0 -g
gcc -O0 -g -pthread -o "$O/native/stockd" "$N/deadlock.c"
# reportd
gcc -O1 -o "$O/native/aggregate" "$N/aggregate.c"
gcc -O1 -o "$O/native/fxfetch" "$N/fxfetch.c"; strip "$O/native/fxfetch" "$O/native/aggregate"
# vendor
g++ -O2 -shared -fPIC -o "$O/vendor/libcalc.so" "$N/libcalc.cpp"; strip --strip-unneeded "$O/vendor/libcalc.so"
x86_64-linux-gnu-gcc -O1 -nostdlib -static -ffreestanding -o "$O/vendor/vendor-tool" "$N/hello_x86.c"; x86_64-linux-gnu-strip "$O/vendor/vendor-tool"
echo "build-id prod crashme: $(readelf -n "$O/native/crashme" | awk '/Build ID/{print $3}')"
echo "build-id 0419: $(readelf -n "$O/symbols/build-0419.debug" | awk '/Build ID/{print $3}')"
echo "build-id 0412: $(readelf -n "$O/symbols/build-0412.debug" | awk '/Build ID/{print $3}')"
