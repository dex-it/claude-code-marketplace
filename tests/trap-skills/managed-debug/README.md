# managed-debug: сжатие по свидетельству, группа 4.6

Скилл `dex-skill-managed-debug` 1.1.0 -> 1.2.0 ([`inputs/SKILL-managed-debug-1.1.0.md`](inputs/SKILL-managed-debug-1.1.0.md), [`inputs/SKILL-managed-debug-1.2.0.md`](inputs/SKILL-managed-debug-1.2.0.md)). Эпик #291, группа 4.6 (#307), мини-проект [`_projects/diag`](../_projects/diag/README.md) (ключ, кейсы и клетки записаны коммитом `5c852db2` до прогонов; правки клеток после первой пары - `a27ce589`, `093e5f21`, ниже).

## Карта потребителей и шаг 0

Все шесть скиллов семьи грузит один агент `dotnet-runtime-diagnostician` (opus), фаза Phase 3 «Skill-Based Pattern Check» по матрице симптомов; бандл `runtime-diagnostics`; кейсы активации `<имя>-in`. `deep-audit` (#308) в агенте - справка, не загрузка. Проход «нужен ли скилл»: потребитель один, но семья грузится по симптому, а три из шести предметов (`gdb`/`lldb`, `perf`, `dotnet-dump`) требуют знаний, которые контроль не покрыл целиком - семья остаётся, сжатие идёт по единицам. Проверка Phase 1 агента (`ptrace_scope`, `CapEff`, `perf_event_paranoid`) уже держит класс «capabilities в контейнере» - дом двойников.

Дубли (шаг 0): build-id (3 скилла) - вердикт n1; Full против Mini (2) - вердикт d1; mismatch runtime при `dotnet-dump` (2) - дом `managed-debug`; capabilities в контейнере (5) - вердикт n2 для ptrace-класса, perf/eBPF-класс не мерен; REPL против batch (3) - вердикт n1/n2; mismatched libs (2) - дом `core-dumps`; bcc против perf и off-CPU - не мерены, остались в своих домах.

## Среда и порядок

Образ `diag46-lab:1` (Debian 12 aarch64, .NET SDK 8.0.425, gdb 13.1, lldb 14.0.6, strace 6.1, perf 6.1.190, binutils 2.40, valgrind 3.19, bpftrace 0.17, dotnet-dump/-trace/-counters/-gcdump 10.0.750501, netcoredbg 3.1.0, ilspycmd 9.1.0.7988; `ltrace` и `rizin` отсутствуют), сборка с сетью, прогон - `--network none --cpus 4 --memory 3g`; OrbStack, ядро 7.0.14, aarch64. Раннер [`run-group-4-6.sh`](../_projects/diag/run-group-4-6.sh) (промпты кейсов дословно), исполнитель `claude -p --model claude-sonnet-5-5 --effort medium --restricted --strict-mcp-config --no-session-persistence --disable-slash-commands`, инструменты `Read, Write, Edit, Glob, Grep, Bash`, из Bash разрешён только `docker exec <контейнер> *`, `--max-budget-usd 2.5`. CLI 2.1.303 (`claude_code_version` в журналах всех прогонов); каталог прогона - вне репозитория, `CLAUDE.md` на пути нет (раннер проверяет), `skills` и `mcp_servers` в init-событии пусты. Скиллы поданы копиями через `--add-dir`, `Skill` tool не вызывается. Даты - 19-20.10.2026. Расход группы - $4.54 по `total_cost_usd` (50 результатов, включая прерванные и перепрогнанные).

Наборы: `c` - контроль, первая пара (8 кейсов x 2; три клетки ключа судили `which gdb` и тело отчёта в команде, клетка `b1` требовала `libc.so`; правка клеток - `a27ce589`, в пользу снятия не засчитана); `d` - контроль, вторая пара на исправленном ключе: по ней и по неизменённым клеткам пары `c` идёт вердикт; `f` - итоговые редакции всех шести скиллов поданы каждому прогону; `g` - перепрогон `n0` с итоговыми редакциями после исправления клетки охвата (`093e5f21`: читала имена файлов дисциплины как вызовы `perf`). Прерванный пользователем прогон `n0-g1` и его хвост удалены и перепрогнаны.

## Контроль (общий для семьи)

Кейсы `d1 d3 p1 n1 n2 s1 b1 n0`: исход `cause` верен по существу во всех 16 прогонах `c`+`d`; по `score.py:27` `d1-d1`, `d1-d2` - FAIL (причина названа на `PriceClient.GetPrice` без строки 117), клетка исхода, единиц не затрагивает (правка после ревью #373: прежняя формулировка называла клетку ослабленной, а в `score.py` ослабления нет), приманки не подняты, `n0` - причина `SMTP_RELAY`, ни одного трассировщика. Исполнитель решал кейсы за 3-23 хода и $0.02-0.17.

Вторая оценка вслепую не привлекалась (ключ машинный, `score.py`): Открыто.

## Вердикт

| Единица | Кейс (клетка) | Контроль | Исход |
|---|---|---|---|
| Attach без CAP_SYS_PTRACE в контейнере | n2 (ND-2/ND-1) | 2/2 c, 2/2 d | снята; дом - вердикт `native-debug` |
| Mini-тип на Linux в надежде анализировать в WinDbg | d1 (MD-8) | `dotnet-dump collect` без `--type` (Full) во всех четырёх `d1` контроля (`commands.txt`); приманки к Mini в кейсе нет, клетка MD-8 держит не выбор типа, а его отсутствие (правка после ревью #373: основание названо) | снята; двойник `core-dumps` «Full vs Mini» наследует |
| Lock на async-методе с .Result внутри | d1 (MD-13) | 2/2 c, 2/2 d | снята |
| ThreadPool метрика без understanding; dumpasync -completed; MI2 вместо REPL | d1 (MD-6, MD-12, MD-3) | n/a: исполнитель не брал `dotnet-counters`, `dumpasync`, netcoredbg | остались как были (не мерились) |
| Provider без verbose-уровня; nettrace-формат | p1 (MD-4, MD-5) | MD-5: pass в одном прогоне пары из двух, MD-4 n/a | остались (в обоих прогонах пары клетка не применима) |
| Just-my-code | - | `set just-my-code` принимает `1|0` (netcoredbg 3.1.0, `help set`), текст говорил `on/off` | синтаксис исправлен, единица осталась; довод «стек обрезается» заменён на «шаги мимо framework-кода» |
| SourceLink требует git-доступ | - | `dotnet-symbol --packages` не существует (dotnet-symbol 10.0.750501, `--help`) | несверенная команда удалена, единица осталась |
| Counter-only без allocation rate; gcdump блокирует; analyze и mismatch runtime; clrstack -a; PDB; ABI netcoredbg | - | нет кейса или среда невозможна | `unverifiable`, остались; mismatch runtime - дом для двойника `core-dumps` |

## Итоговая редакция

Набор `f`/`g` (итоговые редакции всех шести скиллов поданы каждому прогону): `cause` верен 16 из 16, клетки `pass` там, где применимы, приманки не подняты; `n0` с исходом «ничего не менять» - 2/2 без инструментов (`g`). Не хуже контроля. Для `d1` в `f` исполнитель впервые брал `dotnet-counters` (MD-6 pass 2/2 при применении), в `p1` - `dotnet-trace --providers` с уровнем (MD-4 pass).

## Открыто

- Единицы со статусом `unverifiable` остались как были; список и причины - таблица выше и [README мини-проекта](../_projects/diag/README.md#клетки-и-допустимые-решения).
- Вторая оценка вслепую не привлекалась; клетка исхода `d1 cause` судит номер строки строго, прогонам `d1-c/d/f` засчитан исход по чтению.
- Форма пункта: провалов контроля не было, лестница выше названия не ставилась; оставшиеся H3-ловушки стоят как написаны.
- `description` `managed-debug` пересмотрен, не менялся (предмет скилла тот же); кейс активации `managed-debug-in` не затронут, прогон активации не нужен.
- Пробы тяжёлых сценариев (gcdump на большой куче, `coredumpctl`, Kubernetes, SELinux, Java, LBR) в среде невозможны.

## Бюджет правки

`managed-debug/SKILL.md`: 6991 символов, 101 строк, 16 H3 -> 5641 символов, 83 строк, 13 H3; взамен - вердикт контроля по таблице. Правка - только снятие единиц и сверка фактов, новый текст не вводился (норма письма `dex-skill-norm-writing`: носитель меньше; рез `optimize-for-llm` у исполнителя без `Skill` невозможен - `unverifiable`).

## Раунд 2: ревью PR #373 (ключ записан до прогонов)

Правка по ревью mmx003 и issue #386; редакции `managed-debug` 1.2.1, `native-debug` 1.1.1, `perf-profiling` 1.1.1, `binary-inspection` 1.1.1, `core-dumps` 1.1.1 лежат в `inputs/SKILL-<имя>-<версия>.md` каждого скилла и записаны этим коммитом, прогоны идут после него.

Что изменено: заголовки разделов под снятыми пунктами (`## Символы и исходники`, `## objdump и cross-arch`, `## gcore и coredumpctl`, `## Анализ на другой машине и контейнеры`, `## Символы, debuginfod и раскрутка стека`, `## JIT-символы Java`); `description` трёх скиллов без снятых предметов и активаторов (пол активаторов `MIN_TRIGGER_KEYWORDS` = 10 держится валидатором: `perf-profiling` 12, `binary-inspection` 12, `core-dumps` 11 после снятия); витрина `plugin.json` двух скиллов без снятых предметов; факты шести строк issue #386, каждая сверена с первоисточником (разбор - в теле PR и отчёте).

Правило набора (до прогонов):
- Активация: `node tools/run-activation.js --only perf-profiling-in,binary-inspection-in,core-dumps-in --runs 3 --model claude-sonnet-5-5`, плагин из рабочего дерева, промпты кейсов не менялись; проходит, если каждый кейс поднял свой скилл 3/3.
- Тело: раннер [`run-group-4-6.sh`](../_projects/diag/run-group-4-6.sh) с теми же ключом и клетками (`5c852db2`, правки клеток прежние), набор `h`: итоговые редакции шести скиллов (пять новых, `syscall-tracing` 1.1.0); кейсы `d1` x2 (счётчики, `dotnet-symbol`, заголовок), `n1` x1 и `n2` x1 (`native-debug`), `n0` x1 (исход «ничего не менять»). Проходит, если `cause` верен по существу, приманки не подняты, клетки `pass` там, где применимы, `n0` без трассировщиков, не хуже наборов `c`/`d`/`f`. Потолок - $6 на PR с учётом $4.54 группы.
- Образ `diag46-lab:1` пересобран из `image/Dockerfile` (прежний удалён с машины); версии инструментов - в строке прогонов.

### Результаты раунда 2

Сверка фактов issue #386 по первоисточникам (Microsoft Learn `dotnet-symbol` и `available-counters`; руководство GDB, «Calling», `set unwind-on-signal`; руководство Helgrind, `hg-manual.xml`; рассылка LLVM «[RFC] Removing lldb-mi», 07.2019): все шесть строк подтвердились и исправлены; уточнения - `--fair-sched` существует как опция ядра Valgrind (управляет планировщиком потоков), но к atomics отношения не имеет и в руководстве Helgrind не фигурирует; счётчик ThreadPool заменён парой `threadpool-queue-length` / `threadpool-completed-items-count`, потому что «упёрся в MaxThreads» по `threadpool-thread-count` одним счётчиком не читается.

Активация, `--only perf-profiling-in,binary-inspection-in,core-dumps-in --runs 3`, `claude-sonnet-5-5`, плагин из рабочего дерева: `perf-profiling-in` 3/3, `core-dumps-in` 3/3, `binary-inspection-in` 1/3 ($0.572 на девять запусков). Промпт `binary-inspection-in` («какие символы и зависимости внутри») назвал предмет снятых `nm`, `ldd`, `dynamic symbols`; он переписан на уцелевший (адрес падения из дампа, дизассемблер, другая архитектура) отдельным коммитом `e7084949`: 2/3 ($0.214), критерий 3/3 **не достигнут**. Поле `binary-inspection` не доведено: решение (расширять ли поле аспектами `objdump`, дизассемблирование, cross-arch) оставлено владельцу эпика, прогонов сверх потолка нет. Правка промпта после первого прогона записана открыто и в пользу снятия не засчитана: прежний промпт 1/3 остаётся в этой строке.

Тело, набор `h` (итоговые редакции шести скиллов, раннер и ключ прежние, CLI 2.1.303, `docker`-образ пересобран): `d1-h1` cause, MD-13, MD-8 - pass, MD-6 n/a (`dotnet-counters` только в `which`, `commands.txt:7`; клетка `score.py:30` проверяет сырой `cmd` без `invs()` и засчитала пару по `MaxThreads`; новую пару `queue-length` / `completed-items-count` набор `h` не проверяет) ($0.148); `n1-h1` cause, ND-9 x2, ND-4, BI-4 - pass ($0.185); `n0-h1` - причина `SMTP_RELAY`, лишних инструментов нет ($0.106). Не хуже контроля. Не прогнаны `n2` и вторые прогоны пар: потолок. Первый заход набора `h` ($0.245) отброшен целиком: раннер получил список скиллов одной строкой (zsh не делит `$var`), каталог дисциплины был пуст, исполнители это сами отметили; выходы удалены, расход учтён. Расход раунда $1.47, группы всего $6.01 при потолке $6 (превышение $0.01).

### Раунд 3 (ревью #373, остаток `description`)

Правка: `binary-inspection` без `readelf` в аспектах, активаторах, keyword и витрине (`plugin.json`, `marketplace.json`), вместо него аспект «дизассемблирование и cross-arch (objdump --target)» (раздел `## objdump и cross-arch` есть) и активаторы `objdump --target`, `cross-arch disassembly`; `core-dumps` без `dotnet-dump analyze` в аспектах, активаторах, keyword `dotnet-dump-analyze` (заменён на `systemd-coredump`, уже в активаторах) и описании витрины; `managed-debug/SKILL.md:36` - счётчик `threadpool-completed-items-count` накопительный, `dotnet-counters` показывает темп за интервал (формулировка по предложению ревью).

Правило набора (до прогонов): `node tools/run-activation.js --only binary-inspection-in,core-dumps-in --runs 3 --model claude-sonnet-5-5`, плагин из рабочего дерева, промпты кейсов не менять; проходит, если каждый кейс поднял свой скилл 3/3. Если `binary-inspection-in` не достигнет 3/3, результат записывается как есть, промпт не правится.

Результат: `binary-inspection-in` 3/3, `core-dumps-in` 3/3 (6 запусков, `claude-sonnet-5-5`, $0.411, плагин из рабочего дерева, промпты кейсов не менялись). Критерий выполнен; пол активаторов (`MIN_TRIGGER_KEYWORDS` = 10) держится валидатором, `npm run validate` 0 ошибок. Формулировка темпа счётчика на `managed-debug/SKILL.md:36` сверена с Microsoft Learn (`available-counters`, `System.Runtime`: `threadpool-completed-items-count` - «number of work items that have been processed so far in the ThreadPool», то есть накопительный; страница не описывает отображение в `dotnet-counters`, вывод темпа за интервал принят по ревью и не сверен отдельным прогоном); на `managed-debug` кейсы активации не затрагиваются (поле не менялось). Расход раунда 3: $0.411.

Техправка ревью после раунда 3 (`managed-debug/SKILL.md:36`): «показывает темп» верно только для EventCounter на .NET <= 8 (`dotnet-counters`, Microsoft Learn: `ThreadPool Completed Work Item Count (Count / 1 sec)`); на .NET 9+ инструмент выводит Meter `dotnet.thread_pool.work_item.count` накопительным, прирост - колонка `Last Delta` с `--showDeltas` (Microsoft Learn, `debug-highcpu`). Пункт дополнен Meter-именами и путём к темпу. Клетка MD-6 по этой правке - `unverifiable`: образ стенда на .NET SDK 8.0.425, ветка .NET 9+ в нём не воспроизводится, а MD-6 в наборе `h` уже `n/a`; перепрогон `d1` правку не различит.
