# REPORT: orders-worker, рост p50 с 0.2 до 3 мс

## Симптом
Процесс `dotnet app/OrdersWorker.dll slow` держит два рабочих потока по ~100% CPU (`top -H`), при этом процесс почти не делает системных вызовов и не ждёт: почти всё время уходит на пользовательский CPU. Время обработки одного запроса выросло с 0.2 до 3 мс.

## Причина
`/work/src/Program.cs:162`, метод `TextUtils.Slugify`, вызывается из горячего пути `Modes.Slow` (`Program.cs:98`). На каждый вызов создаётся новый `Regex` (`new Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)")`). Каждый вызов заново разбирает шаблон, строит интерпретатор и инициализирует таблицы классов символов. Затем используется интерпретируемый режим без `RegexOptions.Compiled` и без кэша. Основное время тратится на разбор и построение регулярного выражения, а не на сопоставление.

## Улики
1. Системные вызовы не объясняют задержку. Команда: `strace -f -c -p 11` (5 с). Вывод: `futex 51.6% (7 мкс/вызов), restart_syscall 47.8%`, это простаивающие потоки. Остальные вызовы практически ничего не стоят.
2. Нагрузка идёт на пользовательском CPU. Команда: `top -H -b -n1 -p 11`. Вывод: `%Cpu(s): 100.0 us, 0.0 sy`, потоки 19 и 20 по 99.9% и 93.3%.
3. Сэмплирование CPU. Сервис перезапущен с `DOTNET_PerfMapEnabled=1 DOTNET_EnableWriteXorExecute=0`. Команды: `perf record -F 499 -g -p <PID> -- sleep 8`, затем `perf report --children --sort symbol --stdio -g none`. Фрагмент вывода (колонки: total, self):
   ```
   99.79%  0.10%  Modes+<>c::<Slow>b__6_1()
   96.88%  0.40%  string TextUtils::Slugify(string)
   46.57%  0.43%  RegexReplacement::ReplaceSimpleText(...)
   44.21%  1.04%  Regex::RunAllMatchesWithCallback(...)
   37.42%  0.43%  RegexInterpreter::Scan(...)
   33.48%  0.10%  Regex::.ctor(string, CultureInfo)
   26.84%  0.31%  RegexParser::Parse(...)
    8.28%  0.08%  RegexParser::ParseReplacement(...)
   ```
   На `Slugify` приходится 96.9% времени. Конструктор `Regex` с разбором шаблона даёт 33.5%, то есть regex создаётся на каждый вызов. Первый прогон без perf-map показал 79% в `memfd:doublemapper`, то есть в JIT-коде.
4. Самые тяжёлые функции по self: `RegexInterpreter::TryMatchAtCurrentPosition` 7.5%, `RegexCharClass::CharInCategoryGroup` 6.6%, `CharInClassRecursive` 5.3%, `TryFindNextStartingPositionLeftToRight` 5.1%. Вся верхушка профиля состоит из regex-кода.
5. Ограничения замера. Профиль снят на запущенном `slow`-режиме. Режим до релиза для сравнения не запускался, поэтому замера «до/после» нет. Строки 98 и 162 найдены по исходникам уже после того, как профиль указал на `Slugify`.

## Что предлагаю
- Вынести `Regex` в `static readonly` поле, чтобы шаблон разбирался один раз. Желательно добавить `RegexOptions.Compiled` либо использовать `[GeneratedRegex]` (.NET 8).
- Либо заменить regex простым проходом по строке (`char.IsLetterOrDigit`) без выделения памяти.
- После правки повторить `perf record` и убедиться, что `Slugify` и `Regex::.ctor` ушли из верха профиля, а p50 вернулся к ~0.2 мс.
- Код сервиса я не менял. Сервис остановлен командой `pkill -x dotnet` после замеров, поэтому его нужно запустить заново: `cd /work && dotnet app/OrdersWorker.dll slow`.
