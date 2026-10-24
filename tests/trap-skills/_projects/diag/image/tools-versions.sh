#!/bin/sh
for t in gdb lldb strace ltrace perf objdump readelf nm addr2line valgrind bpftrace dotnet netcoredbg dotnet-dump dotnet-trace dotnet-counters dotnet-gcdump dotnet-symbol ilspycmd; do
  printf '%s: ' "$t"; (command -v $t >/dev/null && ($t --version 2>&1 | head -1)) || echo MISSING
done
python3 -c 'import lief;print("lief",lief.__version__)' 2>&1 | tail -1
