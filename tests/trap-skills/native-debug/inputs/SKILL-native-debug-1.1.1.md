---
name: native-debug
description: Native CLI debug - GDB batch и MI2, LLDB Python scripting, ptrace attach, debuginfod, символы, backtrace, valgrind memcheck/helgrind. Активируется при gdb, lldb, attach, ptrace, ptrace_scope, debuginfod, backtrace, symbol mismatch, stripped binary, breakpoint, watchpoint, native crash, sigsegv, sigabrt, valgrind, memcheck, helgrind
---

# Native CLI debug - ловушки агентного применения GDB / LLDB / valgrind

## Permissions и attach

### SELinux / AppArmor поверх Yama
Плохо: `ptrace_scope=0`, но attach всё равно `EPERM`
Правильно: `getenforce` (SELinux) / `aa-status` (AppArmor) / `ausearch -m AVC -ts recent` для денаев; для теста временно `setenforce 0`
Почему: LSM-стек работает после Yama. Permissive Yama не гарантирует пропуск через SELinux/AppArmor MAC

## Batch и scripting

### lldb-mi removed в новых LLVM
Плохо: использовать `lldb-mi` для structured output (вынесен из LLVM в 2019 году, до LLVM 10, в отдельный репозиторий без поддержки)
Правильно: `lldb -b -o "process attach --pid <PID>" -o "thread backtrace all"`; для programmatic - lldb Python API через `lldb.SBProcess`
Почему: lldb-mi не поддерживается, заменили на `lldb-dap` (Debug Adapter Protocol). Старые примеры из интернета не работают

### MI2 для GDB
Плохо: парсинг GDB human-output регэкспом - разные версии форматируют по-разному
Правильно: `gdb --interpreter=mi2 -ex "-stack-list-frames" -p <PID>` - stable structured MI2-протокол
Почему: human-output - часть UI и меняется. MI2 - спецификация и совместим между версиями

## Символы, debuginfod и раскрутка стека

### Stripped binary без отдельного .debug
Плохо: backtrace = `0x7f... in ??()`, agent делает выводы по адресам
Правильно: на debug-машине `apt install <package>-dbgsym`, либо `debuginfod-find debuginfo <build-id>`; включить `set debuginfod enabled on` в GDB
Почему: production-бинари stripped. Без `.debug`-файла или debuginfod backtrace бесполезен - адреса вместо имён функций

### debuginfod URL не настроен
Плохо: GDB 10.1+ умеет debuginfod, но `DEBUGINFOD_URLS` пуст - silent fallback на локальный поиск
Правильно: `export DEBUGINFOD_URLS="https://debuginfod.ubuntu.com https://debuginfod.fedoraproject.org"` (distro-specific) до запуска GDB
Почему: без URL клиент не знает куда обращаться. На прод-машине без интернета - готовый локальный `/usr/lib/debug/.build-id/XX/YYYY.debug` обязателен

### bt full без понимания optimized-кода
Плохо: `bt full` показывает «out of range» и `<optimized out>` для локалей, агент считает это багом
Правильно: для prod-бинарей `bt` (без full) или ловить адрес и `info locals`; full полезен только для debug-сборки
Почему: компилятор оптимизирует переменные в регистры или удаляет вообще. `<optimized out>` это норма, не ошибка дебаггера

### Backtrace оборван на ??
Плохо: считать что crash в библиотеке когда `bt` обрывается на `??`
Правильно: проверить frame pointers (`-fno-omit-frame-pointer`), для DWARF unwind сверить `.eh_frame` / `.debug_frame` (`readelf -S`); для stripped - debuginfod
Почему: без frame pointers и без DWARF unwind GDB не может развернуть стек до самого низа. Обрыв - артефакт компиляции, не место настоящего crash

## Coredump open

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
Правильно: сверить по коду, что пара обращений не упорядочена lock'ом; для собственных примитивов и atomics разметить порядок `ANNOTATE_HAPPENS_BEFORE` / `ANNOTATE_HAPPENS_AFTER` из `helgrind.h`; `--read-var-info=yes` лишь добавляет имена переменных в отчёт (дороже по памяти и времени)
Почему: helgrind моделирует happens-before через locks, не понимает custom synchronization (atomics, RCU, lock-free). False positives часты
