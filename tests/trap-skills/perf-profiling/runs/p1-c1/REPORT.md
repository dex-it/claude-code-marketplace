# REPORT: orders-worker, рост p50 с 0.2 до 3 мс

## Симптом
После релиза обработчик orders-worker (`dotnet app/OrdersWorker.dll slow`) стал медленнее: p50 вырос с 0.2 до 3 мс.
Процесс постоянно занят CPU: в `top -H` два рабочих потока по ~100% каждый (суммарно ~193%).
Пауз, ожидания и роста памяти нет (rss ≈ 68 MB, inflight=0). Значит, время уходит на вычисления, а не на блокировки.

## Причина
`/work/src/Program.cs:162`, метод `TextUtils.Slugify`, вызывается из `Program.cs:98`.
На каждый вызов создаётся новый `Regex`:
`var rx = new Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)");`
Каждый раз заново разбирается шаблон, строится дерево и интерпретатор. Кэша и статического экземпляра нет.
Режимы `Compiled` и `RegexOptions` не заданы, поэтому работает интерпретатор.
Дополнительно сам матчинг по юникодным классам `\p{L}`, `\p{Nd}`, `\p{P}` недешёвый.

## Улики
1. Загрузка по потокам:
   `docker exec diag46-p1-c1 sh -c 'top -H -b -n1 -p 11'`
   `PID 19 ... 99.9 %CPU`, `PID 20 ... 99.9 %CPU`. Два потока заняты на 100%.

2. Профиль CPU. Запуск: `DOTNET_PerfMapEnabled=1 DOTNET_EnableWriteXorExecute=0 dotnet app/OrdersWorker.dll slow`.
   Замер: `perf record -F 499 -g -p <pid> -- sleep 8`, затем `perf report --children --sort sym`.
   Без `EnableWriteXorExecute=0` JIT-код попадал в `memfd:doublemapper` и не получал имён.
   ```
   99.72%  Modes+<>c::<Slow>b__6_1()
   96.75%  TextUtils::Slugify(string)
   44.22%  RegexReplacement::ReplaceSimpleText(...)
   41.66%  Regex::RunAllMatchesWithCallback(...)
   35.35%  Regex::.ctor(string, CultureInfo)
   35.24%  RegexInterpreter::Scan(...)
   28.16%  RegexParser::Parse(...)
   ```
   Self-время: `RegexInterpreter::TryMatchAtCurrentPosition` 7.4%, `RegexCharClass::CharInCategoryGroup` 6.5%,
   `CharInClassRecursive` 4.4%, `RegexParser::ScanReplacement/ScanCharClass/ScanRegex` вместе ~4.5%.

3. `Slugify` занимает 96.75% времени рабочего потока. Из них ~35% приходится на конструктор `Regex` (разбор шаблона на каждый вызов).
   Ещё ~42% уходит на сам матчинг и замену в интерпретаторе.

4. Лог `/work/logs/worker.log` показывает ~1 млн обработанных элементов за 2 с, то есть работа идёт непрерывно и упирается в CPU.

## Что предлагаю
1. Вынести `Regex` в `static readonly` поле и не создавать его на каждый вызов.
   Это убирает ~35% времени (разбор шаблона и построение дерева).
2. Добавить `RegexOptions.Compiled` или использовать `[GeneratedRegex]` (.NET 8), чтобы уменьшить стоимость самого матчинга.
   Лучше проверить, нужны ли здесь юникодные классы. Если нет, упрощение шаблона до ASCII ускорит матчинг ещё сильнее.
3. После правки повторить `perf` и сравнить p50 до и после. Правку я не вносил: по условию код не менялся.

Примечание: при диагностике сервис перезапускался несколько раз (в том числе с `DOTNET_PerfMapEnabled`). Сейчас он запущен штатной командой `slow`.
