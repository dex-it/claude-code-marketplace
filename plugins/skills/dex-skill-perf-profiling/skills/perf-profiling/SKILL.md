---
name: perf-profiling
description: Linux sampling-профилирование - perf record/script/report, FlameGraph folded stacks, on-CPU vs off-CPU, hot path, JIT-символы для .NET и Java. Активируется при perf record, perf script, flamegraph, hot path, cpu profiling, off-cpu, kernel.perf_event_paranoid, frame pointers, dwarf unwinding, jit profiling, dotnet perf, perfmap, sampling
---

# Linux perf-profiling - ловушки sampling-анализа

## Permissions

### perf_event_paranoid блокирует event capture
Плохо: `perf record -F 99 -a -g sleep 30` под user-аккаунтом - `permission denied`
Правильно: проверить `cat /proc/sys/kernel/perf_event_paranoid`. >=2 (default) - запрет kernel events; для prod-machine рекомендуется 1 (samples + tracepoints) или 0 (kernel addresses тоже); либо `sudo perf record ...`
Почему: paranoid - sysctl Linux для ограничения perf_event_open(). Уровень 4 (Debian) даже user-events запрещает без CAP_PERFMON

### CAP_PERFMON вместо CAP_SYS_ADMIN
Плохо: устаревший совет - давать процессу CAP_SYS_ADMIN для perf
Правильно: kernel 5.8+ - использовать CAP_PERFMON (узкий cap для perf events) и CAP_BPF (для eBPF probes)
Почему: CAP_SYS_ADMIN - root-equivalent; CAP_PERFMON разделён специально для observability с минимумом прав

## Frame pointers и unwinding

### Backtrace без frame pointers
Плохо: `perf record -g` на бинаре собранном без `-fno-omit-frame-pointer` - flamegraph «плоский», виден только main
Правильно: для собственного кода `-fno-omit-frame-pointer`; для prod-бинарей чужих - `--call-graph dwarf,16384` (DWARF unwind, дорого)
Почему: компилятор по умолчанию убирает frame pointer для оптимизации регистров. Без него perf не может развернуть стек, видит только текущий кадр

### DWARF unwind size
Плохо: `--call-graph dwarf` без размера - дефолт 8192 байт, глубокие стеки обрезаются
Правильно: `--call-graph dwarf,16384` для типовых сервисов; `--call-graph dwarf,65536` для очень глубоких (.NET, Java, async chains)
Почему: при unwind perf копирует часть user-stack в каждый sample. Маленький размер обрезает глубокий стек, потеря root cause

### LBR быстрее DWARF на Intel
Плохо: всегда DWARF из-за «совместимости»
Правильно: на Intel CPU с LBR (Last Branch Record) - `--call-graph lbr` дешевле, глубина 16-32 фрейма
Почему: LBR использует hardware-регистры процессора, не копирует stack. На AMD/ARM - недоступен или другой механизм

## On-CPU vs Off-CPU

### Spinning loop виден, блокировка нет
Плохо: flamegraph не показывает причину slowdown - busy функция в hot path не найдена
Правильно: для off-CPU (sleep, lock wait, io_wait) - bpftrace `offcputime` или `perf sched`; on-CPU и off-CPU - разные сценарии
Почему: perf record sample CPU; sleeping thread не в выборке. «Где провёл время» = on-CPU + off-CPU вместе

### Sched events для блокировок
Плохо: использовать только sampling для диагностики «почему ждёт»
Правильно: `perf sched record -- sleep 30` потом `perf sched latency` - распределение времени по wake-up
Почему: scheduler tracepoints показывают context switches и wake-up задержки. Альтернатива - `bpftrace tracepoint:sched:sched_switch`

## FlameGraph

### Folded stacks pipeline
Плохо: писать `perf record` и не знать как смотреть результат
Правильно: `perf record -F 99 -a -g -- sleep 30` -> `perf script | stackcollapse-perf.pl | flamegraph.pl > out.svg`; для агента - inline SVG в отчёт
Почему: pipeline `perf script -> stackcollapse -> flamegraph.pl` - стандартный workflow Brendan Gregg, SVG читается в браузере

### Differential flamegraph для регрессий
Плохо: визуально сравнивать два flamegraph «было / стало»
Правильно: `difffolded.pl folded-before folded-after | flamegraph.pl > diff.svg`; красный - стало хуже, синий - лучше
Почему: глазами разница в 5% не видна, дифф визуализирует процентные изменения по функциям

## JIT-символы для .NET и Java

### .NET без PerfMap
Плохо: flamegraph .NET-сервиса показывает все managed-функции как `JIT-frame-0xdeadbeef`
Правильно: `DOTNET_PerfMapEnabled=1` и `DOTNET_EnableEventPipe=1` в env процесса; perfmap-файлы появляются в `/tmp/perf-<PID>.map`
Почему: JIT-код не имеет статических символов в бинаре. PerfMap - текстовый файл `<addr> <size> <symbol>`, который perf читает автоматически

### Java aync-profiler vs perf
Плохо: пытаться `perf record` Java-приложение и парсить через стандартный pipeline
Правильно: async-profiler (jvmti) - правильный инструмент; perf для Java требует `-XX:+PreserveFramePointer` и agentlib для перевода JIT в perfmap
Почему: JVM по умолчанию не preserve frame pointer, perf видит только JIT-frame адреса. async-profiler знает JVM internals

## Контейнеры

### perf под Docker без caps
Плохо: `docker exec -it container perf record` - permission denied на perf_event_open
Правильно: `docker run --cap-add=PERFMON --cap-add=SYS_PTRACE --security-opt seccomp=unconfined`; для прод-debug - sidecar privileged container
Почему: Docker дефолтные seccomp + cap drop блокируют perf_event_open syscall. На Kubernetes - hostPID и privileged для observability-pod

### Kernel symbols в контейнере
Плохо: flamegraph в контейнере показывает kernel frames как `0xffff...`
Правильно: mount `/proc/kallsyms` от host в контейнер; либо `perf record` на host с фильтром по cgroup
Почему: kernel symbols читаются из `/proc/kallsyms` процесса. Контейнер видит свой `/proc`, kernel symbols недоступны без mount

> .NET dotnet-trace - managed-эквивалент perf для EventPipe-событий - см. dex-skill-managed-debug.
> Прод-observability через OpenTelemetry / OTel - см. dex-skill-observability.
