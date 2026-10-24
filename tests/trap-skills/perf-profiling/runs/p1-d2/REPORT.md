# Отчёт: orders-worker (режим slow)

## Симптом
После релиза p50 обработчика вырос с 0.2 до 3 мс. Процесс `dotnet app/OrdersWorker.dll slow` держит ~175% CPU на двух рабочих потоках. Узких мест по IO нет: `strace -c` показывает в основном futex и ожидание, диска и сети почти нет. Это CPU-bound.

## Причина
`TextUtils.Slugify` (`/work/src/Program.cs:160`) на каждый вызов создаёт новый объект `Regex` (строка 162): `new Regex(@"[^\p{L}\p{Nd}]+(?:[\s\p{P}]*)")`. Метод вызывается из горячего цикла (`Program.cs:98`, режим Slow).
Каждый вызов заново разбирает и строит шаблон (RegexParser/RegexWriter), а затем прогоняет интерпретатор. Кэша нет, `RegexOptions.Compiled` не задан. Классы Unicode `\p{L}`, `\p{Nd}`, `\p{P}` при сопоставлении тоже дороги.

## Улики
Профиль `perf` с `DOTNET_PerfMapEnabled=1 DOTNET_EnableWriteXorExecute=0` (без второй переменной JIT-символы не разрешаются), 8 с, 499 Гц, 7153 сэмпла:

    perf record -F 499 -g -p PID -- sleep 8
    perf report --children --sort sym -g none

    99.72%  Modes+<>c::<Slow>b__6_1()
    97.65%  TextUtils::Slugify(string)
    47.90%  RegexReplacement::ReplaceSimpleText
    45.17%  Regex::RunAllMatchesWithCallback
    36.17%  Regex::.ctor(string, CultureInfo)     <- конструктор Regex на каждый вызов
    28.60%  RegexParser::Parse
     6.86%  RegexWriter::Write

Self-время (`--no-children`): `RegexInterpreter::TryMatchAtCurrentPosition` 7.4%, `RegexCharClass::CharInCategoryGroup` 6.9%, `CharInClassRecursive` 5.6%, `TryFindNextStartingPositionLeftToRight` 5.1%. Всё это внутри System.Text.RegularExpressions.

Строки исходников для ссылки найдены так: `grep -n -i -E "regex|Slugify" /work/src/Program.cs` → `98: var slug = TextUtils.Slugify(title);`, `160: public static string Slugify(string s)`, `162: var rx = new System.Text.RegularExpressions.Regex(...)`.

## Что предлагаю
- Вынести регулярное выражение в `private static readonly Regex` (или `[GeneratedRegex]`, или `RegexOptions.Compiled`), чтобы оно создавалось один раз. Это уберёт около 36% (конструктор и разбор шаблона).
- Если допустима упрощённая семантика, заменить `\p{L}`/`\p{P}` ручным проходом по символам. Это убрало бы и остальные ~45% на сопоставление.
- Если результат зависит только от `title`, кэшировать его.
- После правки повторить замер тем же способом.

Код и конфигурацию я не менял. Сервис перезапускался и сейчас работает с `DOTNET_PerfMapEnabled=1` и `DOTNET_EnableWriteXorExecute=0`, что его замедляет. Для штатного режима нужен перезапуск без этих переменных.
