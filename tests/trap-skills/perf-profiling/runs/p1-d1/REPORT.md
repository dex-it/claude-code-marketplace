# Симптом
orders-worker (`dotnet app/OrdersWorker.dll slow`): p50 вырос с 0.2 до 3 мс. Два рабочих потока (TID 19, 20) держат ~100% CPU каждый, остальные потоки спят. В RSS и очереди (`inflight=0`) аномалий нет.

# Причина
`src/Program.cs:162` — в `TextUtils.Slugify` на каждый вызов создаётся `new Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)")`. Паттерн каждый раз разбирается и строится заново (`Regex..ctor` → `RegexParser.Parse`), без статического поля и без кэша. Вызывается из горячего цикла `Program.cs:98`.

# Улики
1. `top -H -b -n1 -p 11` — CPU заняли только два рабочих потока:
   `19 root ... R 99.9 ... dotnet`
   `20 root ... R 93.3 ... dotnet`
   (поток 11 — главный, в `Thread.Sleep`; остальные 0.0).
2. `strace -c -f -p 11` (8 с) — потоки в основном ждут на futex, а не крутятся в системных вызовах. Узкое место — CPU в managed-коде, а не ввод-вывод:
   `85.22 ... futex`, `0.68 ... membarrier`.
3. `dotnet-trace collect -p 11 --duration 00:00:08 --profile dotnet-sampled-thread-time --format speedscope`, свёртка по стекам, поток 19 (поток 20 аналогичен):
   - `incl 8015 OrdersWorker!Modes+<>c.<Slow>b__6_1()`
   - `incl 8001 OrdersWorker!TextUtils.Slugify(String)`
   - `incl 5486 System.Text.RegularExpressions!Regex..ctor(String, CultureInfo)`
   - `self 7696 CPU_TIME`
   Поток 20: `Slugify` 7994 из 8015, `Regex..ctor` 5404.
   Итого: ~99.8% времени рабочих потоков в `Slugify`, ~67–68% — в конструкторе `Regex` (разбор паттерна); остальное — `Replace`.

# Что предлагаю
- Вынести regex в статическое поле: `private static readonly Regex Rx = new(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)", RegexOptions.Compiled);`. Либо использовать `[GeneratedRegex]`, либо статический `Regex.Replace`, который кэширует паттерн.
- После правки повторить замер `dotnet-trace`: `Regex..ctor` должен пропасть из профиля, p50 — вернуться к ~0.2 мс.
- Код в рамках диагностики не менялся.
