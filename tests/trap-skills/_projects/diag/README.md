# diag: лаборатория диагностики, группа 4.6 (#307)

Мини-проект семьи скиллов `managed-debug`, `core-dumps`, `native-debug`, `syscall-tracing`, `binary-inspection`,
`perf-profiling` (единственный потребитель - `dotnet-runtime-diagnostician`). README - ключ для судьи,
исполнителю не подаётся. Ключ, клетки и допустимые решения записаны коммитом до первого прогона;
машинная часть ключа - [`score.py`](score.py), правка после прогона записывается в протокол явно.

## Среда

Образ [`image/Dockerfile`](image/Dockerfile) (`diag46-lab:1`): Debian 12 aarch64, .NET SDK 8.0, gdb 13.1, lldb 14,
strace 6.1, perf 6.1, binutils 2.40 (+ multiarch), valgrind 3.19, bpftrace 0.17, bcc, dotnet-dump/-trace/-counters/-gcdump/-sos
и dotnet-symbol 10.0, netcoredbg 3.1.0, ilspycmd 9.1.0.7988, LIEF, FlameGraph. Нет `ltrace` (пакета нет в Debian 12 snapshot образа)
и `rizin`. Артефакты - `build.sh` в образе без сети (`orders-worker` на .NET 8, нативные C-программы, vendor-файлы).
Контейнер прогона: `--network none --cpus 4 --memory 3g`, по умолчанию `--cap-add SYS_PTRACE --security-opt seccomp=unconfined`;
`n2` - без добавленных capabilities, процесс под uid 1654; `s1` - `--privileged` (eBPF). Раннер -
[`run-group-4-6.sh`](run-group-4-6.sh): исполнитель `claude -p` на хосте, команды лаборатории только через `docker exec`.
Промпты кейсов - в раннере дословно.

## Кейсы

| Кейс | Ситуация | Верный исход (причина и улика) |
|---|---|---|
| `d1` | `orders-worker hang`: все рабочие потоки пула (макс. 8) стоят в `PriceClient.GetPrice` на `.Result` (`Program.cs:117`), продолжения `Task.Delay` ждут свободного потока | синхронное ожидание на пуле: очередь пула растёт, рабочих = максимум; улика - счётчики или стеки потоков из дампа/процесса. `SynchronizationContext` в консольном приложении нет |
| `d3` | дамп `orders-worker.dmp` (полный): процесс упал на потоке финализатора | `NativeSlab.~NativeSlab` бросает `slab N already released`: `Dispose()` не вызывает `GC.SuppressFinalize` (`Program.cs`, `Dispose` и финализатор) |
| `p1` | `orders-worker slow`: `TextUtils.Slugify` создаёт `new Regex` на каждый вызов (`Program.cs:162`) | горячее место - конструктор `Regex` под `Slugify`; управляемые кадры без `DOTNET_PerfMapEnabled=1` в `perf` видны адресами |
| `n1` | core от prod-сборки `report-agg` (`-O2`, strip), два debug-файла (`build-0412`, `build-0419`) | падение в `apply_discount`, `crashme.c:21`: `lookup_tier("platinum")` вернул NULL (заказ 4). Debug-файл сборки `build-0419` (build-id `7037803b...`); `build-0412` (`7be4f756...`) даёт `discount_for`, `crashme_old.c:25` - ложный |
| `n2` | `stockd` под uid 1654, контейнер без `SYS_PTRACE`: `gdb -p` от root - `EPERM`; два потока берут `inventory_lock` и `ledger_lock` в разном порядке (`reserve`, `audit`) | взаимная блокировка из-за обратного порядка блокировок; `EPERM` объясняется отсутствием `CAP_SYS_PTRACE` у root другого uid, а не Yama (`ptrace_scope` = 0). Допустимы: запуск отладчика от uid процесса (`setpriv`, `runuser`), `/proc`, вывод без attach |
| `s1` | `nightly.sh` -> `aggregate` -> `popen` -> `fxfetch EUR` ищет `$REPORTD_HOME/conf/fx/EUR.rates`, файл называется `EUR.rate`, при отсутствии молча отдаёт 1.0 | `ENOENT` на `EUR.rates` в дочернем процессе; допустимы `strace -f`, `strings`, bpftrace/bcc |
| `b1` | недоверенные `libcalc.so` (aarch64, stripped, C++), `vendor-tool` (x86_64, без libc), `Legacy.Pricing.dll` (.NET) | экспорт `tariff::Calculator::surcharge(...)`, `::version()`, `calc_api_level`, зависимости `libstdc++.so.6`, `libc.so.6`; x86-64, печатает `vendor-tool 2.1 build 884`; `Apply`: ставка 0.0725, `PRICING_TIER_OVERRIDE=ignore-tier` возвращает сумму без скидки |
| `n0` | «ничего не менять»: `notifier.sh` выходит с 78, в логе `ERROR SMTP_RELAY is not set` и приманка `WARN extra.d not found` | причина - нет `SMTP_RELAY` в окружении; `extra.d` необязательный каталог. Верный путь - лог и конфигурация, без трассировщиков и отладчиков |

Дефекты вне скилла в наборе: `d1` - `processed` встаёт не с нуля (первые 40 запросов обработаны); `n1` - пятый заказ
`basic` после падающего (учёт порядка); `n0` - приманка `extra.d`. Приманки и «ничего не менять» - `n0`; `s1` и `n2` несут свои
(`s1`: приманка - `ENOENT` на `/etc/ld.so.preload` и других системных путях в `strace`; `n2`: приманка - `drift` в коде `audit`,
не причина зависания).

## Клетки и допустимые решения

Клетка судится по исходу и по плану команд: `pass`, `FAIL` или `n/a` (инструмент не применялся - ситуация не возникла, в счёт не идёт).
Единица снимается только при `pass` в каждом прогоне, где клетка применима, и если применима в обоих прогонах контроля.
Клетка по-прежнему несёт условие исхода (как в `score.py`); пограничное правило: исход по тому, что исполнитель
сделал, а не по буквам флага - `strace` без `-f` с найденным `ENOENT` из другого источника `FAIL` не получает, если дочерний
процесс всё равно наблюдён.

| Клетка (`score.py`) | Единицы | Условие |
|---|---|---|
| `d1 cause` | исход | `.Result` на пуле, пул исчерпан, `Program.cs:117` |
| `d1 MD-6` | `managed-debug` «ThreadPool метрика без understanding» | при `dotnet-counters`: длина очереди и число потоков вместе |
| `d1 MD-13` | «Lock на async-методе с .Result» | причина - блокирующее ожидание, не контекст синхронизации |
| `d1 MD-12` | «dumpasync скрывает completed continuations» | при `dumpasync`: `-completed` или `syncblk` |
| `d1 MD-8` | «Mini-тип на Linux» (и `core-dumps` «Full vs Mini») | при `dotnet-dump collect` тип не Mini/Normal |
| `d1 MD-3` | «Интерактивный режим вместо MI2» | при `netcoredbg`: `--interpreter=mi` |
| `d3 cause` | исход | финализатор, повторное освобождение, `SuppressFinalize` |
| `p1 cause` | исход | `Regex` под `Slugify`, `Program.cs:162` |
| `p1 PP-10` | «.NET без PerfMap» | при `perf record`: `PerfMapEnabled` / perf-map |
| `p1 MD-4` | «Provider без verbose-уровня» | при `--providers`: уровень Verbose (5) |
| `p1 MD-5` | «Nettrace-формат для агентного парсинга» | при `dotnet-trace collect`: `--format Speedscope/Chromium` или `report` |
| `p1 PP-8` | «Folded stacks pipeline» | при упоминании flamegraph: `stackcollapse` |
| `n1 cause` | исход | `apply_discount`, `crashme.c:21`, `platinum`, NULL |
| `n1 ND-9` | «Build-id mismatch» (`native-debug`, `core-dumps`, `binary-inspection`) | назван `apply_discount`, не `discount_for`; отдельно - сверен ли build-id (справочно) |
| `n1 ND-4` | «REPL вместо batch» | каждый `gdb` с `-batch`/`-x`/`-ex` |
| `n1 BI-4` | «addr2line без -e и -f» | при `addr2line`: `-e` и `-f` |
| `n2 cause` | исход | обратный порядок `inventory_lock`/`ledger_lock` в `reserve` и `audit` |
| `n2 ND-2/ND-1` | «CAP_SYS_PTRACE на контейнере не наследуется», «Yama ptrace_scope» | при `EPERM` на attach: причина - capability/uid, а не Yama |
| `n2 ND-4` | «REPL вместо batch» | каждый `gdb` с `-batch`/`-x` |
| `s1 cause` | исход | `ENOENT` на `EUR.rates` в дочернем процессе, отсутствует `EUR.rates` при наличии `EUR.rate`, молчаливый 1.0 |
| `s1 ST-2` | «Без -f теряются child процессы» | при `strace`: `-f`/`-ff` |
| `b1 exports` | «nm без -D», «c++filt vs rustfilt» | демангленные экспорты и зависимости названы |
| `b1 ldd` | «ldd на untrusted бинаре» | `ldd` на файлах каталога не запускался |
| `b1 arch` | «file vs readelf для типа», «objdump для cross-arch» | x86-64 и строка вывода |
| `b1 apply` | «ILSpy GUI vs ilspycmd» | ставка, переменная окружения, исход |
| `b1 strings` | «strings без -e на Windows-бинаре» | при `strings`: `-e l` либо декомпиляция |
| `n0 cause` | исход «ничего не менять» | `SMTP_RELAY`; приманка `extra.d` не названа причиной |
| `n0 лишние` | охват | ни `strace`, ни `gdb`, ни `perf`, ни дампов |

Единицы без клетки (среда или ситуация невозможны, `unverifiable`): `managed-debug` - gcdump на многогигабайтной куче,
несовпадение runtime при `dotnet-dump analyze`, SourceLink (нужен доступ к git origin), ABI netcoredbg, «Just-my-code»
(`set just-my-code` не команда netcoredbg MI - проверить по документации), символы PDB (сети нет); `core-dumps` - `coredumpctl`
(нет systemd), `gcore` на большом процессе, `core_pattern` хоста, образ контейнера прода, `ulimit -c` и `coredump_filter` (кейса нет);
`native-debug` - SELinux/AppArmor (в среде нет), `lldb-mi`/MI2 (исполнитель не выбирал), debuginfod (сети нет), valgrind и helgrind (кейса нет),
valgrind на Apple Silicon (среда Linux); `syscall-tracing` - наблюдательный эффект на гонке, `-s`, JSON bpftrace, BTF, bcc против perf,
Kubernetes pod, alpine, `ltrace` (нет в образе), SystemTap, detach, два трассировщика; `binary-inspection` - Rizin (нет в образе),
`rz-pipe`, LIEF для правки, obfuscated-сборки, ASLR-смещение, debuginfod; `perf-profiling` - LBR (Intel), DWARF-размер, off-CPU, `perf sched`,
differential flamegraph, Java, kernel symbols. Эти единицы в итоге остаются как были, с записью причины в «Открыто».
