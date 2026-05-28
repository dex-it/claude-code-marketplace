---
name: managed-debug
description: Runtime .NET debug - netcoredbg, dotnet diagnostic tools, SOS, managed dumps, GC heap analysis, async stack. Активируется при netcoredbg, dotnet-dump, dotnet-trace, dotnet-counters, dotnet-gcdump, dotnet-stack, sos, managed heap, finalizer queue, LOH, gen2 GC, threadpool starvation, managed deadlock, async hang, eventpipe
---

# Managed .NET runtime debug - ловушки runtime-диагностики

## Attach и launch

### Attach без CAP_SYS_PTRACE в контейнере
Плохо: `docker exec -it ... netcoredbg --interpreter=mi --attach <PID>` без `--cap-add=SYS_PTRACE`
Правильно: контейнер запускается с `--cap-add=SYS_PTRACE --security-opt seccomp=unconfined`, либо `--privileged` для тестового окружения
Почему: ядро Linux требует CAP_SYS_PTRACE для cross-process attach. Docker по умолчанию её не даёт - silent fail или `ptrace: Operation not permitted`

### Just-my-code маскирует framework-кадры
Плохо: `netcoredbg ... -ex "set just-my-code on"` при разборе hang в чужом async-коде
Правильно: `set just-my-code off` пока root cause не локализован
Почему: при `on` стек обрезается на первом не-user кадре, теряется ContinueWith / TaskScheduler.UnobservedTaskException - именно там часто живёт hang

### Интерактивный режим вместо MI2 для скриптинга
Плохо: запускать `netcoredbg` без `--interpreter=mi`, пытаясь скриптовать REPL
Правильно: `netcoredbg --interpreter=mi --attach <PID>`, далее MI2-команды `-thread-info`, `-stack-list-frames`, парсинг по `^done`
Почему: REPL выводы нестабильны от версии к версии, MI2 - стабильный structured-формат под GDB/MI2 spec

## EventPipe и dotnet-trace

### Provider без verbose-уровня
Плохо: `dotnet-trace collect --providers Microsoft-DotNETCore-SampleProfiler --process-id <PID>`
Правильно: `--providers Microsoft-DotNETCore-SampleProfiler:0xFFFFFFFFFFFFFFFF:5` (keywords + level Verbose=5)
Почему: без уровня и keywords trace пустой или содержит только Informational-события. Speedscope покажет «No events» - кажется что профайлер сломан

### Nettrace-формат для агентного парсинга
Плохо: дефолтный `.nettrace` в pipeline когда нужен human-readable анализ
Правильно: `--format Speedscope` для UI или `--format Chromium` для DevTools; `.nettrace` оставлять для PerfView
Почему: `.nettrace` это бинарный CLR-EventPipe формат. Без PerfView и Chrome его не открыть, агент не сможет распарсить stdout

## dotnet-counters и live metrics

### ThreadPool метрика без understanding
Плохо: смотрим `threadpool-thread-count` и решаем «много thread'ов - всё ок»
Правильно: одновременно `threadpool-queue-length` (растёт = starvation), `working-threads` (упёрся в `MaxThreads` = starvation), `monitor-lock-contention-count`
Почему: ThreadPool starvation проявляется как «queue растёт, working-threads = MaxThreads, latency деградирует». ThreadCount без queue не диагностичен

### Counter-only без allocation rate
Плохо: фиксируем «gen0-gc-count высокий» как root cause GC pressure
Правильно: одновременно `alloc-rate` (байт/сек), `gen2-gc-count` (gen2 дорог), `% time in gc`
Почему: gen0 GC дёшев, gen2 дорог. Высокий gen0 без alloc-rate не значит pressure - может быть просто busy app

## dotnet-dump и dotnet-gcdump

### Mini-тип на Linux в надежде анализировать в WinDbg
Плохо: `dotnet-dump collect --type Mini` на Linux потом попытка `windbg core.dump`
Правильно: на Linux всегда `--type Full`, анализ только через `dotnet-dump analyze`
Почему: Mini на Linux - не Windows minidump формат. WinDbg на Linux core не работает. Full включает managed metadata, читается только `dotnet-dump`

### gcdump блокирует процесс на multi-GB heap
Плохо: `dotnet-gcdump collect -p <PID>` на prod-сервисе с heap 8GB во время инцидента
Правильно: до prod-инцидента понимать что gcdump блокирует worker на seconds-minutes; в проде использовать `dotnet-counters` для live или `dotnet-dump --type Full` для post-mortem
Почему: gcdump делает stop-the-world GC + serializes heap; multi-GB heap = заметная пауза, может вызвать health-check fail и перезапуск

### Analyze падает на mismatch версии runtime
Плохо: dump собран на prod-машине .NET 8.0.10, analyze запущен на dev-машине .NET 8.0.5
Правильно: установить точно совпадающий runtime через `dotnet-symbol --recurse-subdirectories <dumpfile>` или развернуть прод-runtime локально
Почему: SOS-плагин и метаданные ABI привязаны к конкретному build runtime. Mismatch даёт `Failed to load CLR` или искажённые managed stack frames

## SOS-команды и async stack

### clrstack -a без локалей символов
Плохо: `dotnet-dump analyze core.dump` -> `clrstack -a`, ожидание увидеть параметры методов
Правильно: сперва `setsymbolserver -ms` или `dotnet-symbol --symbols --reference-symbols <dump>`, потом `clrstack -a`
Почему: `-a` (locals и parameters) требует public PDB символов. Без них видны только имена методов, аргументы как `<no data>`

### dumpasync скрывает completed continuations
Плохо: `!dumpasync` показал три pending state-machines, root cause «найден»
Правильно: `!dumpasync -completed` дополнительно, плюс `!syncblk` для managed monitors, `!clrthreads -live` для активных threads
Почему: `dumpasync` по умолчанию фильтрует завершённые. Cause hang может быть в continuation, которая уже вернула Task но висит на нижестоящем .Wait()

## ThreadPool starvation и async hang

### Lock на async-методе с .Result внутри
Плохо: считать «hang в async-методе - это deadlock на SynchronizationContext»
Правильно: проверить через `dumpasync` нет ли цепочки `.Result` / `.Wait()` / `GetAwaiter().GetResult()` в hot-path; одновременно `dotnet-counters` `threadpool-queue-length`
Почему: ASP.NET Core нет SynchronizationContext capture, классический deadlock редок. Чаще starvation от `.Result` блокирующего worker thread

> Антипаттерны `.Result` / `.Wait()` / missing ConfigureAwait в библиотеках - см. `dex-skill-dotnet-async-patterns`.
> IDisposable / HttpClient lifetime / socket exhaustion как причины managed leak - см. `dex-skill-dotnet-resources`.
> Structured logging как первая линия диагностики - см. `dex-skill-dotnet-logging`.

## Mismatched symbols и SourceLink

### PDB не подгружены - стеки в IL-смещениях
Плохо: managed stack показывает `MyApp.Service.Process+IL_0042` вместо `Service.cs:123`
Правильно: `dotnet-symbol --recurse-subdirectories <dump-or-dll>` для restore из symbol server; для прода - embedded PDB через `<DebugType>embedded</DebugType>` в csproj
Почему: portable PDB не embedded по умолчанию. На prod-машине отдельный .pdb рядом с .dll отсутствует, символизация падает на public symbol server fallback

### SourceLink требует git-доступ к origin
Плохо: при анализе дампа netcoredbg выдаёт `Source not available` для своего же кода
Правильно: проверить что PDB содержит SourceLink JSON (`pwsh -c "& dotnet-symbol --packages <pdb> -o ."`), доступ к git-origin из debug-машины
Почему: SourceLink резолвит `https://raw.githubusercontent.com/...` по коммит-хэшу. Без auth или offline-машины ссылка не открывается, source не подгружается

### netcoredbg ABI mismatch с runtime
Плохо: на машине .NET 9 SDK + netcoredbg, собранный против .NET 7
Правильно: качать netcoredbg release под нужный major-runtime; проверка `netcoredbg --version` и `dotnet --info`
Почему: netcoredbg линкуется против конкретной версии CoreCLR. Mismatch проявляется как segfault внутри отладчика или silent detach без сообщения
