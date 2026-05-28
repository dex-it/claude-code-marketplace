---
name: native-debug
description: Native CLI debug - GDB batch и MI2, LLDB Python scripting, ptrace attach, debuginfod, символы, backtrace, valgrind memcheck/helgrind. Активируется при gdb, lldb, attach, ptrace, ptrace_scope, debuginfod, backtrace, symbol mismatch, stripped binary, breakpoint, watchpoint, native crash, sigsegv, sigabrt, valgrind, memcheck, helgrind
---

# Native CLI debug - ловушки агентного применения GDB / LLDB / valgrind

## Permissions и attach

### Yama ptrace_scope блокирует cross-process attach
Плохо: `gdb -p <PID>` для процесса не-родителя - silent fail или `ptrace: Operation not permitted`
Правильно: проверить `cat /proc/sys/kernel/yama/ptrace_scope`. 1 (default Ubuntu) - только parent; временно поднять `sudo sysctl -w kernel.yama.ptrace_scope=0`; контейнер запускать с `--cap-add=SYS_PTRACE`
Почему: Yama LSM блокирует ptrace по умолчанию на десктопах и в современных дистрибутивах. Без явной проверки тратится время на silent failures

### CAP_SYS_PTRACE на контейнере не наследуется автоматически
Плохо: `docker run my-app` потом attach из соседнего контейнера
Правильно: `docker run --cap-add=SYS_PTRACE --security-opt seccomp=unconfined` или `--pid=host` для shared namespace
Почему: Docker по умолчанию даёт минимальный набор capabilities. seccomp-фильтр также может блокировать ptrace syscall независимо от CAP

### SELinux / AppArmor поверх Yama
Плохо: `ptrace_scope=0`, но attach всё равно `EPERM`
Правильно: `getenforce` (SELinux) / `aa-status` (AppArmor) / `ausearch -m AVC -ts recent` для денаев; для теста временно `setenforce 0`
Почему: LSM-стек работает после Yama. Permissive Yama не гарантирует пропуск через SELinux/AppArmor MAC

## Batch и scripting

### REPL вместо batch при агентном запуске
Плохо: `gdb -p <PID>` и попытка скриптовать stdin последовательно
Правильно: `gdb -batch -ex "thread apply all bt" -p <PID>` (одной командой, exit после `-batch`); для нескольких `-ex` подряд
Почему: REPL ожидает интерактивный stdin, parsing неустойчив. `-batch` гарантирует завершение и stable exit code

### lldb-mi removed в новых LLVM
Плохо: использовать `lldb-mi` для structured output (его удалили начиная с LLVM 16+)
Правильно: `lldb -b -o "process attach --pid <PID>" -o "thread backtrace all"`; для programmatic - lldb Python API через `lldb.SBProcess`
Почему: lldb-mi не поддерживается, заменили на `lldb-dap` (Debug Adapter Protocol). Старые примеры из интернета не работают

### MI2 для GDB
Плохо: парсинг GDB human-output регэкспом - разные версии форматируют по-разному
Правильно: `gdb --interpreter=mi2 -ex "-stack-list-frames" -p <PID>` - stable structured MI2-протокол
Почему: human-output - часть UI и меняется. MI2 - спецификация и совместим между версиями

## Символы и debuginfod

### Stripped binary без отдельного .debug
Плохо: backtrace = `0x7f... in ??()`, agent делает выводы по адресам
Правильно: на debug-машине `apt install <package>-dbgsym`, либо `debuginfod-find debuginfo <build-id>`; включить `set debuginfod enabled on` в GDB
Почему: production-бинари stripped. Без `.debug`-файла или debuginfod backtrace бесполезен - адреса вместо имён функций

### debuginfod URL не настроен
Плохо: GDB 10.1+ умеет debuginfod, но `DEBUGINFOD_URLS` пуст - silent fallback на локальный поиск
Правильно: `export DEBUGINFOD_URLS="https://debuginfod.ubuntu.com https://debuginfod.fedoraproject.org"` (distro-specific) до запуска GDB
Почему: без URL клиент не знает куда обращаться. На прод-машине без интернета - готовый локальный `/usr/lib/debug/.build-id/XX/YYYY.debug` обязателен

### Build-id mismatch
Плохо: подкинули `.debug` от соседней сборки, GDB загрузил, backtrace стал «осмысленным», но врёт
Правильно: `readelf -n binary` -> Build ID; `readelf -n debugfile` -> тот же Build ID; debuginfod-find ищет по точному build-id автоматически
Почему: при mismatch GDB не предупреждает явно, символы накладываются «как смогут», результат - перепутанные line numbers и имена функций

## Backtrace и фреймы

### bt full без понимания optimized-кода
Плохо: `bt full` показывает «out of range» и `<optimized out>` для локалей, агент считает это багом
Правильно: для prod-бинарей `bt` (без full) или ловить адрес и `info locals`; full полезен только для debug-сборки
Почему: компилятор оптимизирует переменные в регистры или удаляет вообще. `<optimized out>` это норма, не ошибка дебаггера

### Backtrace оборван на ??
Плохо: считать что crash в библиотеке когда `bt` обрывается на `??`
Правильно: проверить frame pointers (`-fno-omit-frame-pointer`), для DWARF unwind использовать `set unwindonsignal on`; для stripped - debuginfod
Почему: без frame pointers и без DWARF unwind GDB не может развернуть стек до самого низа. Обрыв - артефакт компиляции, не место настоящего crash

## Coredump open

### Порядок аргументов и mismatched libs
Плохо: `gdb core.dump binary` - наоборот
Правильно: `gdb /path/to/binary /path/to/core`; для mismatched libc - `set sysroot /path/to/prod-rootfs` или контейнер с тем же base image
Почему: первый аргумент - executable, второй - core. Без правильного sysroot stack frames внутри libc/loader =`??`

### Watchpoints на coredump бесполезны
Плохо: открыли core, поставили watchpoint, ждём срабатывания
Правильно: на core доступны только инспекция (frame, info locals, x/, print); watch/break активны только на живом процессе
Почему: core - snapshot, не runtime. Hardware watchpoint требует процесс с регистрами и debug-stop, в core этого нет

## Valgrind для memory leak и race

### Valgrind на оптимизированном бинаре
Плохо: `valgrind ./app-Release` - предупреждения «possibly lost» в библиотечном коде, без line numbers
Правильно: пересобрать с `-O0 -g` для проверяемого модуля; для production-бинарей - heaptrack или AddressSanitizer как альтернатива
Почему: valgrind инструментирует runtime, но без debug-symbols точное место не определяется; оптимизатор inline'ит и теряет fp

### Helgrind на блокировках без понимания false-positives
Плохо: helgrind репортит «possible race», agent применяет это как root cause
Правильно: пройти `--read-var-info=yes`, для C++ atomics добавить `--fair-sched=yes`; ложные срабатывания на lock-free структуры - норма
Почему: helgrind моделирует happens-before через locks, не понимает custom synchronization (atomics, RCU, lock-free). False positives часты

### Valgrind на Apple Silicon не работает
Плохо: разработчик на M1 macOS пытается `brew install valgrind`
Правильно: Apple Silicon - не поддерживается valgrind (Linux x86_64/ARM only, macOS до Ventura 13.x x86_64); для macOS arm64 использовать `leaks` (preinstalled) и AddressSanitizer
Почему: backend valgrind не портирован на arm64-macOS. На M1 brew формула либо отсутствует, либо ставит нерабочую сборку

> Permissions для перехвата событий ядра (perf_event_paranoid, CAP_BPF) - см. dex-skill-syscall-tracing.
> Анализ coredump с managed-метаданными (SOS, dotnet-dump analyze) - см. dex-skill-core-dumps.
