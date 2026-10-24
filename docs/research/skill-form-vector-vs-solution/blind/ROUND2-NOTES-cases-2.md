# Раунд 2: заметки

## Принцип усиления

Все 25 строк раунда 1 исполнитель ловил потому, что ловушка была видна в одном месте и совпадала с
«хрестоматийной» формой (`[NotMapped]`-свойство в Where, `Clear()` при Restrict, Unspecified в timestamptz,
явная фраза про дубли). В раунде 2 каждая строка `unit` устроена по одному из трёх направлений ROUND2.md:

1. **Очевидный и рекомендуемый способ неверен именно здесь**: DateTimeOffset «надёжнее DateTime» - но Npgsql
   не пишет смещение ≠ 0 (K1); `DateTime.UtcNow` - но все DateTime глобально `timestamp` (K3); `ExecuteDelete`
   для массового удаления - но мимо мягкого удаления (K4); `IgnoreQueryFilters` для удалённых - но в EF 8
   снимает и фильтр арендатора (K5); `SingleOrDefault` при уникальном индексе - но индекс не покрывает NULL (K3)
   и регистр (K5).
2. **Поведение меняет настройка в другом файле**: глобальный SplitQuery (K2, KR), `DeleteOrphansTiming = Never`
   в конструкторе контекста (K6), `ConfigureConventions` (K3), endpoint-фильтр с `SaveChangesAsync` (K5),
   фильтры запросов в отдельном файле (K5), долгоживущий контекст фонового сервиса (K2).
3. **Новый код проходит через существующий**: проекция с клиентским методом, поверх которой новый код
   сортирует/фильтрует (K1, KR), явный список колонок сырого SQL, ломающийся от нового свойства (K6), условные
   JOIN построителя SQL (K6), загрузчик без Include (KR), `now()` в пачке синхронизации (KR).

Проект нигде не формулирует нужный исход; факты домена даны там, где без них исход не однозначен
(K4: «удалённый проект заводили заново под тем же кодом», KR: «длинные названия принтер обрезал»,
KR: «повторный осмотр - отдельная запись, планшет шлёт пачкой»).

## Остаточные риски (не проверено запуском - в среде нет исполнения кода)

- Утверждения ключей сверены с документацией (SOURCES.md); места, где применение - вывод, а не цитата,
  помечены «вывод»: First = LIMIT 1 при split (K2), сравнение с null-параметром (K3, документация показывает
  два nullable-столбца), повтор алиаса в FROM (K6), выполнение FromSqlRaw без композиции как есть (KR),
  равенство value object целиком (K4-h).
- K5: фильтры запросов заданы в методе-расширении с параметром `SchoolDbContext db`; EF подставляет текущий
  контекст в выражения типа DbContext (как в примере документации с полем `_context` в
  IEntityTypeConfiguration), но именно эта форма запуском не проверена.

## Устаревшие файлы

Удалить файлы в этой среде нечем, поэтому они заменены однострочной пометкой и не входят ни в один
`cases/*.json`: `inputs/K1/ReaderExtensions.cs`, `inputs/K3/GreenhouseDbContext.cs`,
`inputs/K3/ReadingsService.cs`, `inputs/K3/Migrations/20250214093000_Initial.cs`,
`inputs/K3/deploy/pipeline.yml`, `inputs/K5/ForumDbContext.cs`, `inputs/K5/EventService.cs`,
`inputs/KR/Infrastructure/SqlText.cs`, `inputs/KR/Migrations/20260915120000_DriverDisplayNameAndTripRoute.cs`.
Их можно удалить.

## Сводка: единица -> строки ключа

| Единица | Строки `unit` | `harm` / `mine` |
| --- | --- | --- |
| untranslatable-filter | K1-debtors-fine, K4-year-closed, KR-offday-rows | K1-h-loanrows, K4-h-month-equality |
| readonly-tracking | K2-freeze-fresh, K5-instructor-list | K2-m-passes-notracking, K5-m-notracking (mine) |
| single-not-unique | K3-contract-null, K5-login-email | K3-h-bycontract, K5-h-find-exact |
| fromsql-alias | K6-sort-alias, K6-search-columns, KR-open-semicolon | K6-h-limit, KR-h-plate-fromsql |
| datetime-column | K1-period-offset, K3-credit-time | K1-h-today-utc, K3-m-utcnow (mine) |
| softdelete-cascade | K4-client-projects, K5-graduates-school | - |
| required-orphans | K6-plan-orphans, KR-equipment-clear | K6-h-move-items, KR-h-permits-clear |
| split-single | K2-random-session, KR-last-inspection | K2-h-course-split |
| prod-migration | K4-code-index, KR-model-length | - |

KN не менялся (6 harm на 6 единиц + 2 coverage).

## Какие два места связать (по строкам `unit`)

- **K1-debtors-fine** - `LoanRows.ToLoanRows` (Fine/DaysOverdue считаются клиентским `Fines.*` в проекции) и новый `OrderBy`/`Sum` поверх неё.
- **K1-period-offset** - тип `Loan.IssuedAt` (`DateTimeOffset` -> timestamptz) и пример тела запроса со смещением `+05:00`.
- **K2-freeze-fresh** - контекст `TurnstileWorker`, созданный один раз до цикла, и отслеживающая загрузка `Member` в цикле, откуда берётся признак заморозки.
- **K2-random-session** - `UseQuerySplittingBehavior(SplitQuery)` в Program.cs и случайный порядок в запросе с коллекцией записавшихся.
- **K3-contract-null** - `PaymentPurpose.ExtractContractNo` возвращает `string?` и уникальный индекс по nullable `ContractNo` (у заявок NULL).
- **K3-credit-time** - `ConfigureConventions` (все DateTime - `timestamp without time zone`) и `DateTime.UtcNow` в новом коде.
- **K4-year-closed** - `HasConversion` у `ClosedPeriod.Month` (YearMonth -> int) и обращение `p.Month.Year` в новом запросе.
- **K4-client-projects** - override `SaveChangesAsync` (мягкое удаление) и `ExecuteDelete`, который его обходит (при ON DELETE CASCADE на записях времени).
- **K4-code-index** - фильтр `!IsDeleted` в проверке `CreateAsync` (дубли с удалёнными возможны, см. комментарий у `RestoreProjectAsync`) и новый уникальный индекс в миграции.
- **K5-login-email** - регистрозависимый уникальный индекс (SchoolId, Email) при сохранении e-mail «как ввели» и поиск без учёта регистра через `Single*`.
- **K5-graduates-school** - комбинированный фильтр `SchoolId && !IsDeleted` в `QueryFilters.cs` и `IgnoreQueryFilters` в отчёте.
- **K5-instructor-list** - `SaveChangesFilter` на группе `/api` в Program.cs и мутирующий `Student.MaskForInstructor` на отслеживаемой сущности.
- **K6-sort-alias** - условные `JOIN apartments a`/`houses h` в `SearchAsync` и новый `ORDER BY` по адресу.
- **K6-search-columns** - явный список колонок в SQL `SearchAsync` и новое свойство `ServiceRequest` из (б)/(г).
- **K6-plan-orphans** - `DeleteOrphansTiming = Never` в конструкторе `HousingDbContext` и удаление работ из `plan.Items`.
- **KR-offday-rows** - `TripRow.OffDay` = `WorkCalendar.IsWorkingDay` в `ToRows()` и `Where(r => r.OffDay)` в `OffDayTripsAsync`.
- **KR-open-semicolon** - завершающая `;` в SQL `GetOpenWaybillsAsync` и условный `Where` поверх `FromSqlRaw`.
- **KR-equipment-clear** - `FindVehicleAsync` без `Include(Equipment)` и `Equipment.Clear()` в `ReplaceEquipmentAsync` (плюс уникальный индекс vehicle_id+code).
- **KR-model-length** - `AlterColumn` model до varchar(40) в миграции и факт из MR.md, что на prod есть длинные названия.
- **KR-last-inspection** - `CreatedAt` с `now()` и пакетный `SyncInspectionsAsync` (одна транзакция) против `OrderByDescending(CreatedAt)` + Include при глобальном SplitQuery.

## Изменения раунда 2

- **K1** (библиотека): убраны `IsOverdue`, `MaskContacts`/ExportLog, Unspecified-период. Новые ловушки: сортировка/итог по полям клиентской проекции `ToLoanRows`; период как `DateTimeOffset` со смещением. `ReaderExtensions.cs` заменён на `Fines.cs`.
- **K2** (студия): убраны поиск по телефону, `Clear()` при Restrict, «ближайшее занятие». Добавлен фоновый `TurnstileWorker` с долгоживущим контекстом (заморозка абонемента) и «тайный гость» - случайное занятие при глобальном SplitQuery.
- **K3** заменён: был мониторинг теплиц, стал биллинг провайдера - поиск по nullable-уникальному номеру договора и глобальный `timestamp` через `ConfigureConventions`.
- **K4** (агентство): убраны теги-конвертер, Include перед Remove, Update-конфликт. Новые: value object `YearMonth` с конвертером, массовое удаление проектов (`ExecuteDelete` в обход мягкого удаления), уникальный код проекта при дублях среди удалённых.
- **K5** заменён: были мероприятия, стала облачная сеть автошкол - вход по e-mail без учёта регистра, отчёт с `IgnoreQueryFilters` при общем фильтре школы, маскирование при автосохранении в endpoint-фильтре.
- **K6** (УК): убраны whitelist-сортировка как единственная ловушка, COUNT поверх LIMIT, индекс по лицевому счёту. Новые: условные JOIN в построителе SQL, явный список колонок, ломающийся от нового поля, замена плана при `DeleteOrphansTiming = Never`.
- **KR** (автопарк): новый MR !238 - пять единиц (клиентский метод в Where после проекции, `;` в компонуемом FromSqlRaw, `Clear()` незагруженной коллекции, сужение varchar на prod, неуникальный порядок по `now()` при SplitQuery) и два дефекта вне EF Core (последний день допуска, нет политики на endpoint).
- **keys.yaml**: строки K1-K6, KR переписаны (20 `unit`, 10 `harm`, 3 `mine`, 2 `coverage`); KN без изменений.
- **SOURCES.md**: добавлены источники D24-D41, таблица строк ключа переписана; строки KN сохранены.
