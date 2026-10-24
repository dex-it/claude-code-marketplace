# [снят] dotnet-caching: сжатие по свидетельству, группа 2.2

Скилл `dex-skill-dotnet-caching` 1.0.2 ([`inputs/SKILL-1.0.2.md`](inputs/SKILL-1.0.2.md)), эпик #291,
группа 2.2 (#297). Итог - скилл снят целиком, единственная выжившая единица H1 перенесена в
`dex-skill-dotnet-resilience` (протокол [dotnet-resilience](../../dotnet-resilience/README.md)).

## Заход

Общий для группы: `dotnet-testing-patterns`, `dotnet-api-development`, `dotnet-csproj-hygiene`,
`dotnet-resilience`, `dotnet-caching`. Вход, ключ и раннер - мини-проект
[`_projects/pricing`](../../_projects/pricing/README.md); кейсы скилла - G-H (код, `feature/price-cache`) и
RV-H (ревью, `feature/card-cache`). Исполнитель - `claude -p`, `claude-sonnet-5-5`, effort medium,
флаги и промпты - [`run-group-2-2.sh`](../../_projects/pricing/run-group-2-2.sh). Выходы -
`runs/<кейс>-<набор><N>/`. Среда, порядок и сборка выходов - протокол
[dotnet-resilience](../../dotnet-resilience/README.md#заход-группы-22).

## Потребители

Ни один бандл скилл не ставит, ни один агент его не называет; by-stack через `stack-registry` он
виден только при ручной установке. Кейс активации `dotnet-caching-in`.

## Контроль

Без скилла, 2 прогона на кейс, расход - в общей сумме группы (протокол
[dotnet-resilience](../../dotnet-resilience/README.md#расход-группы-22)).

| Единица | Кейс | Контроль | Исход |
|---|---|---|---|
| H1 single-flight от `IMemoryCache` | G-H, RV-H | 0/2, 2/2 | мерится: в коде `Lazy` внутри `IMemoryCache.GetOrCreate` (`c1`) и `Task.Run` до вставки (`c2`) - каждый промах идёт к поставщику; в ревью ложный комментарий о single-flight пойман 2/2 |
| H2 ручной сброс уже авто | G-H, RV-H | 2/2, 2/2 | снята |
| H3 запись без тега | G-H, RV-H | n/a, 2/2 | снята: в коде тегов нет, в ревью 2/2 |
| H4 негатив-кэш спекулятивно | G-H, RV-H (P) | 2/2, P не провалена | снята |
| H5 невалидный negative-TTL | RV-H | 2/2 | снята |

## Вердикт

После контроля в скилле остаётся одна единица, и потребителей у скилла нет: отдельная запись
каталога ради одного пункта не доходит ни до одного бандла. H1 - защита зависимости от перегрузки
конкурентными промахами; её предмет общий с `dotnet-resilience`, который едет в бандлах
`dotnet-developer` и `dotnet-fullstack`. Пункт перенесён туда, мерился в редакциях resilience.

| Набор | Редакция H1 в resilience | G-H H1 | RV-H |
|---|---|---|---|
| `n` | `SKILL-n1.md`: «Конкурентные промахи кэша идут в зависимость каждый» | `n1` + (`ConcurrentDictionary.GetOrAdd` + `Lazy`), `n2` - (`Lazy` внутри `IMemoryCache.GetOrCreate`, как `c1`) | H1, H2, H3, H5 2/2; O-H2 2/2, O-H1 1/2 |
| `m` | `SKILL-n2.md`: название + факт «`IMemoryCache.GetOrCreate(Async)` не атомарен, `Lazy` внутри его фабрики вызов не делит» | `m1` + (`TryAdd`/`TryUpdate` лидера, результат делят все), `m2` + (`GetOrAdd` готового `Flight`, грузит создатель); H2, H4, O-H 2/2 | не прогонялся |
| `f` | 1.2.0, формулировка `m` | `f1` + (свой `ConcurrentDictionary` с TCS, грузит вставивший), `f2` + (`TryAdd` записи с TCS); H2, H4, O-H 2/2 | H1, H2, H3, H5, O-H1, O-H2 2/2 |

Факт ступени сверен по learn.microsoft.com - строка в таблице фактов
[ключа](../../_projects/pricing/README.md#факты-на-которые-опирается-ключ).

H2-H5 в контроле 2/2 и в resilience не переносятся. KA1 `dex-skill-fact-verification` (ревью ложного
комментария о single-flight) - другая клетка: контроль её держит, здесь мерится написание кода.

## Бюджет правки

| Носитель | До | После | Взамен |
|---|---|---|---|
| `dex-skill-dotnet-caching` | 3239 символов, 37 строк, 5 ловушек | плагин снят | H1 - пункт в `dotnet-resilience` |
| каталог | запись в `marketplace.json`, строка .NET в `README.md`, кейс `dotnet-caching-in` | сняты | версия каталога 6.14.0 |
