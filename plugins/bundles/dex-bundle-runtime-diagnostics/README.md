# Bundle: dex-bundle-runtime-diagnostics

Bundle для runtime-диагностики .NET-сервисов и нативной границы: hang, crash, leak, slowdown, post-mortem. В отличие от общего `dex-debugger` (статический root-cause по коду через grep, с условной загрузкой .NET-skills) этот бандл оперирует живым процессом или дампом и использует runtime-инструменты: netcoredbg, gdb/lldb, perf, bpftrace, dotnet diagnostic tools.

Цикл диагностики: симптом -> Phase 1 Triage (тип, артефакты, permissions) -> Phase 2 Direct -> Phase 3 Skill-Based Pattern Check (условная загрузка skills под симптом) -> Phase 4 Evidence -> Phase 5 Root Cause + Reproducer -> Phase 6 Fix Recommendation -> Phase 7 Report.

## Installation

```bash
# Linux / macOS / WSL
./install-bundle/install-bundle.sh runtime-diagnostics

# Windows (PowerShell)
.\install-bundle\install-bundle.ps1 runtime-diagnostics

# Preview без установки
./install-bundle/install-bundle.sh runtime-diagnostics --dry-run
```

После установки плагинов отдельной командой ставятся CLI-инструменты:

```bash
# Установить все runtime-диагностические утилиты разом
./install-bundle/install-cli-tools.sh runtime-diagnostics-tools

# Или отдельные инструменты
./install-bundle/install-cli-tools.sh netcoredbg gdb perf bpftrace
```

## Uninstallation

```bash
./install-bundle/uninstall-bundle.sh runtime-diagnostics
.\install-bundle\uninstall-bundle.ps1 runtime-diagnostics
```

## Included Components (13)

### Specialist (1)
- `dex-dotnet-runtime-diagnostician` - агент-диагностик с 7 фазами, симптомная матрица загрузки skills

### Skills, новые в этом bundle (6)
- `dex-skill-managed-debug` - netcoredbg, dotnet diagnostic tools, SOS, managed dumps
- `dex-skill-native-debug` - GDB / LLDB batch, ptrace, debuginfod, valgrind
- `dex-skill-syscall-tracing` - strace, bpftrace JSON, bcc-tools
- `dex-skill-perf-profiling` - perf record/script, FlameGraph, JIT-символы
- `dex-skill-core-dumps` - gcore, coredumpctl, dotnet-dump analyze, mismatched libs
- `dex-skill-binary-inspection` - binutils, Rizin, LIEF, ilspycmd

### Utility (1)
- `dex-netcoredbg-cli` - slash-команды-обёртки над Samsung netcoredbg (`/ncdbg-attach`, `/ncdbg-launch`, `/ncdbg-exec`, `/ncdbg-dump-stacks`)

### Skills, переиспользуемые из маркетплейса (5)
- `dex-skill-dotnet-async-patterns` - антипаттерны `.Result`/`.Wait` для managed deadlock
- `dex-skill-dotnet-resources` - IDisposable, HttpClient lifetime, socket exhaustion
- `dex-skill-dotnet-logging` - structured logging как первая линия диагностики
- `dex-skill-deep-audit` - статический аудит компонента вокруг root cause
- `dex-skill-observability` - OpenTelemetry, метрики, traces

## Платформенная совместимость

- **Linux**: полная поддержка всех инструментов
- **macOS**: netcoredbg (только x86_64; на Apple Silicon - Rosetta или сборка из исходников), gdb (с code-sign), lldb (preinstalled), binutils, Rizin, ilspycmd, dotnet diagnostic tools работают. `strace`, `bpftrace`, `bcc`, `perf`, `valgrind` помечены `__UNSUPPORTED__` - на macOS используются альтернативы (`dtruss`, Instruments.app, `leaks`)
- **Windows**: рекомендуется WSL2. Без WSL: netcoredbg, ilspycmd, dotnet diagnostic tools - работают; native debug инструменты помечены `__UNSUPPORTED__` (используется WinDbg / Visual Studio вне scope бандла)

## Замечания

- Permissions для attach и tracing: проверка `ptrace_scope`, `perf_event_paranoid`, `CapEff` входит в Phase 1 специалиста. Контейнерные сценарии (Docker, Kubernetes) требуют CAP_SYS_PTRACE / CAP_BPF / CAP_PERFMON
- Бандл не предлагает auto-apply fix - Phase 6 формирует предложение, применение - после явного подтверждения пользователя
- Для дополнения статическим анализом кода рядом с runtime-диагностикой - общий `dex-debugger` (грузит .NET-skills по стеку) или ревью-бандл `dex-bundle-code-review`
