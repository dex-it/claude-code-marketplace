# REPORT: orders-worker, режим `slow`

## Симптом
После релиза p50 обработчика вырос с 0.2 до 3 мс. Процесс `dotnet app/OrdersWorker.dll slow` занят CPU: `top -H` показывает три потока по ~93–100% CPU, RSS стабилен (~66 МБ), блокировок нет.

## Причина
`TextUtils.Slugify` (src/Program.cs:162) на каждый вызов создаёт `new Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)")`. Каждый раз заново выполняется разбор и оптимизация паттерна (`Regex..ctor` → `RegexParser.Parse` → `RegexNode.FinalOptimize`). Вызывается из рабочего цикла режима slow (src/Program.cs:98).

## Улики
1. Нагрузка на CPU, а не ожидание: `docker exec diag46-p1-f1 top -b -n1 -H -p <pid>`
   ```
   31 root ... S 99.9 ... dotnet
   40 root ... R 93.3 ... dotnet
   41 root ... R 93.3 ... dotnet
   ```
2. Системные вызовы не объясняют задержку: `strace -c -f -p <pid>` (5 с). Почти всё время приходится на `futex` (фоновые ожидания потоков), заметных блокирующих вызовов нет. Открываются только `/sys/fs/cgroup/memory.current` и `memory.stat`. Их читает GC при частых сборках.
3. Давление на аллокации: `dotnet-counters collect -p <pid> --counters System.Runtime`
   ```
   Allocation Rate (B / 1 sec)        1956940224   (~1.9 ГБ/с)
   Gen 0 GC Count (Count / 1 sec)     58
   % Time in GC since last GC (%)     4
   Monitor Lock Contention Count      0
   ```
   Контеншна нет. GC отнимает лишь 4–5%, но аллокации очень большие.
4. Профиль по методам: `dotnet-trace collect -p <pid> --providers Microsoft-DotNETCore-SampleProfiler:0xFFFFFFFFFFFFFFFF:5 --duration 00:00:05 --format Speedscope`. Суммарное включённое время по кадрам (условные единицы speedscope, всего 25020 на все потоки):
   ```
   10008 Modes+<>c.<Slow>b__6_1()
    9993 TextUtils.Slugify(string)
    7156 System.Text.RegularExpressions.Regex..ctor(string, CultureInfo)
    7129 RegexParser.Parse(...)
    7011 RegexParser.ScanRegex()
    6757 RegexNode.FinalOptimize()
   ```
   `Slugify` занимает ~100% времени рабочего потока (10008 из 10008), из них ~71% — конструктор `Regex`. Остальное время — вторичная работа самой регулярки.

## Что предлагаю
Не создавать `Regex` в каждом вызове. Вынести в `static readonly Regex` (при желании с `RegexOptions.Compiled`) или использовать `[GeneratedRegex]`. Код я не менял. После правки повторить `dotnet-trace` и сравнить p50 (ожидаю возврата к ~0.2 мс).
