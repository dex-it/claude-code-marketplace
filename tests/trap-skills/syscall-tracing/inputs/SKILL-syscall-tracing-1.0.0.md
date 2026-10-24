---
name: syscall-tracing
description: Linux syscall и event tracing - strace, bpftrace JSON output, bcc tools (execsnoop, opensnoop, funclatency, memleak), eBPF в контейнерах. Активируется при strace, bpftrace, bcc, ebpf, syscall, execsnoop, opensnoop, funclatency, memleak, file-not-found tracing, hidden subprocess, slow syscall, blocked io, kprobe, uprobe, btf
---

# Syscall и event tracing - ловушки наблюдения за процессом

## strace overhead и Heisenbug

### strace на race-condition коде
Плохо: `strace -p <PID>` на сервисе с подозрением на race, race «исчезает»
Правильно: для race использовать bpftrace (kernel-side, минимальный overhead) или helgrind; strace - только для логики поведения, не для timing-bug
Почему: strace тормозит процесс в 10-100x через ptrace stops. Race-conditions с узким окном перестают воспроизводиться - observer effect

### Без -f теряются child процессы
Плохо: `strace ./my-script.sh` и удивление что не видно поведения дочерних
Правильно: `strace -f` для child-процессов; `-ff -o trace.log` для отдельных файлов на каждый child
Почему: по умолчанию strace следит только за PID-target. fork() порождает невидимого ребёнка

### Truncated strings
Плохо: `strace ... write(...)` показывает обрезанные строки, agent делает выводы по куску
Правильно: `-s 4096` (длина строки) или `-y` (file descriptors как пути)
Почему: дефолт `-s 32` обрезает payload. Невидно полного URL, SQL-запроса, JSON-body

## bpftrace и JSON output

### JSON-output для агента
Плохо: парсить human-output bpftrace регэкспом
Правильно: `bpftrace -f json -e '...'` - NDJSON стрим, легко парсится агентом
Почему: human-output меняется от версии. JSON-output стабилен начиная с bpftrace 0.16+

### Privileges на проде
Плохо: запускать bpftrace под пользовательской ролью, ожидая работы
Правильно: либо `sudo bpftrace`, либо процессу выдан CAP_BPF + CAP_PERFMON (kernel 5.8+), либо `--unprivileged` ограниченный режим
Почему: eBPF загрузка программ в ядро требует привилегий. Без них bpftrace `permission denied` на attach probe

### Kernel headers vs BTF
Плохо: bpftrace падает на «can't open /lib/modules/.../build/include» на минималистичном контейнере
Правильно: проверить `ls /sys/kernel/btf/vmlinux`. Если BTF есть (kernel 5.x+) - headers не нужны; если нет - `apt install linux-headers-$(uname -r)`
Почему: BTF (BPF Type Format) встраивает type info в ядро. Современные kernels (5.x+) с CONFIG_DEBUG_INFO_BTF не требуют raw headers

## bcc-tools

### Готовые инструменты вместо самописных bpftrace
Плохо: писать свой bpftrace-скрипт для «какие файлы открываются»
Правильно: `opensnoop`; для «какие процессы запускаются» - `execsnoop`; для распределения времени по функции - `funclatency`; для allocation tracking - `memleak`
Почему: bcc-tools - production-tested скрипты для типовых задач. Покрывают 80% сценариев, минимизируют ошибки в собственных скриптах

### bcc vs perf по сценарию
Плохо: bcc-tools для CPU sampling (`funclatency` ловит каждый вызов)
Правильно: bcc-tools для редких/прицельных событий (file open, exec, allocation); perf record для CPU-heavy sampling
Почему: bcc-tools tracing включает probe на каждое событие - дорог при высокой частоте. perf делает statistical sampling

## Контейнеры и tracing

### bpftrace внутри непривилегированного контейнера
Плохо: ожидать что `bpftrace` сработает внутри Kubernetes pod без spec.securityContext
Правильно: host-mode tracing с фильтром по PID namespace / cgroup; либо privileged tracing-pod как sidecar
Почему: eBPF загрузка blocked в user namespaces. Privileged-pod на Kubernetes - стандартная практика для observability (Cilium, Pixie работают так)

### strace в alpine-контейнере
Плохо: ожидать что strace «всегда работает» в alpine
Правильно: проверить наличие через `command -v strace`, при отсутствии `apk add strace`; для скретч-контейнеров - exec в sidecar
Почему: alpine минималистичен, strace не входит в base image. Скретч-контейнер вообще не содержит shell, нужен sidecar с shared PID namespace

## Старые методы

### ltrace вместо современных альтернатив
Плохо: рекомендовать `ltrace` для трассировки library calls
Правильно: для современных бинарей `bpftrace` с uprobe; для отдельной библиотеки - `LD_PRELOAD` обёртка
Почему: ltrace последний релиз 2019, плохо работает с современными PLT-релоками и LTO; multi-threaded поведение нестабильно

### SystemTap при наличии eBPF
Плохо: для глубокой трассировки выбирать SystemTap
Правильно: eBPF (bpftrace, bcc) первый выбор; SystemTap - только когда kernel module нужен и нет BPF
Почему: SystemTap требует kernel-debug-info, компиляция модуля при запуске. eBPF - стандарт современных kernels, безопасный, не требует kernel module

## Live процессы и detach

### Forgot detach
Плохо: `strace -p <PID>` через Ctrl+C - процесс остаётся в `T (stopped)` состоянии
Правильно: Ctrl+C корректно detach'ит при modern strace (5.0+); проверка `cat /proc/<PID>/status | grep State` после; если stuck - `kill -CONT <PID>`
Почему: ptrace при abnormal terminate может оставить tracee в SIGSTOP; современный strace ловит SIGINT и detach'ит, старые версии нет

### Одновременный strace и gdb
Плохо: пытаться `strace -p <PID>` когда уже attached gdb
Правильно: только один ptrace-tracer на процесс; detach один перед attach другого
Почему: ptrace allows только один tracer; второй attach даёт `EPERM` либо ломает первый

> Permissions для kernel events (perf_event_paranoid, frame pointers) - см. dex-skill-perf-profiling.
> .NET diagnostic tools для managed-side трассировки (dotnet-trace EventPipe) - см. dex-skill-managed-debug.
