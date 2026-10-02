# Сверка строк ключа с документацией

Документация проверена 2026-10-02 (learn.microsoft.com, npgsql.org, postgresql.org). Цитаты дословные.
Строки `coverage` не опираются на поведение EF Core / Npgsql и здесь не приводятся.

## Цитаты

- **[D1] Client vs. Server Evaluation** - https://learn.microsoft.com/en-us/ef/core/querying/client-eval
  > "If EF Core detects an expression, in any place other than the top-level projection, which can't be translated to the server, then it throws a runtime exception."

  > "EF Core converts parts of the query into parameters, which it can evaluate on the client side."
- **[D2] Entity Properties** - https://learn.microsoft.com/en-us/ef/core/modeling/entity-properties
  > "By convention, all public properties with a getter and a setter will be included in the model."
- **[D3] Value Conversions, Limitations** - https://learn.microsoft.com/en-us/ef/core/modeling/value-conversions
  > "It isn't possible to query into value-converted properties, e.g. reference members on the value-converted .NET type in your LINQ queries."
- **[D4] Tracking vs. No-Tracking Queries** - https://learn.microsoft.com/en-us/ef/core/querying/tracking
  > "By default, queries that return entity types are tracking. A tracking query means any changes to entity instances are persisted by `SaveChanges`."

  > "No-tracking queries are useful when the results are used in a read-only scenario. [...] If the entities retrieved from the database don't need to be updated, then a no-tracking query should be used."

  > "This makes all your queries no-tracking by default." (о `UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)`)
- **[D5] Identity Resolution** - https://learn.microsoft.com/en-us/ef/core/change-tracking/identity-resolution
  > "System.InvalidOperationException: The instance of entity type 'Blog' cannot be tracked because another instance with the key value '{Id: 1}' is already being tracked."

  > "An important point to notice is that each of the approaches use either a query or a call to one of `Update` or `Attach`, but ***never both***."
- **[D6] Queryable.SingleOrDefault** - https://learn.microsoft.com/en-us/dotnet/api/system.linq.queryable.singleordefault
  > "InvalidOperationException - More than one element satisfies the condition in `predicate`."
- **[D7] SQL Queries** - https://learn.microsoft.com/en-us/ef/core/querying/sql-queries
  > "The FromSql and FromSqlInterpolated methods are safe against SQL injection, and always integrate parameter data as a separate SQL parameter. However, the FromSqlRaw method can be vulnerable to SQL injection attacks, if improperly used."

  > "This code doesn't work, since databases do not allow parameterizing column names (or any other part of the schema)."

  > "It is your responsibility to make sure this string value is safe, sanitizing it if it comes from an unsafe origin; this means detecting special characters such as semicolons, comments, and other SQL constructs, and either escaping them properly or rejecting such inputs."

  > "You can compose on top of the initial SQL query using LINQ operators; EF Core will treat your SQL as a subquery and compose over it in the database."
- **[D8] Npgsql EF Core 6.0 release notes (timestamp rationalization)** - https://www.npgsql.org/efcore/release-notes/6.0.html
  > "DateTime properties now map to `timestamptz` by default, instead of to `timestamp`"

  > "It is no longer possible to write DateTime with Kinds Local or Unspecified to `timestamptz` properties (which are the default for DateTime)."

  > "Similarly, it is no longer possible to write DateTime with Kind UTC to a `timestamp` column."

  > "If the column really should store non-UTC timestamps (local or unspecified), explicitly set the column type back to `timestamp`"
- **[D9] Npgsql Date and Time Handling** - https://www.npgsql.org/doc/types/datetime.html
  > "trying to send a non-UTC DateTime as `timestamptz` will throw an exception"

  Таблица отправки: `timestamp without time zone` - "DateTime (Local/Unspecified)".
- **[D10] DateOnly.ToDateTime(TimeOnly)** - https://learn.microsoft.com/en-us/dotnet/api/system.dateonly.todatetime
  > "The Kind property of the resulting DateTime is initialized to DateTimeKind.Unspecified."
- **[D11] DateTime.Date** - https://learn.microsoft.com/en-us/dotnet/api/system.datetime.date
  > "The value of the Kind property of the returned DateTime value is the same as that of the current instance."
- **[D12] DateTime.ParseExact** - https://learn.microsoft.com/en-us/dotnet/api/system.datetime.parseexact
  > "If `s` does not represent a time in a particular time zone and the parse operation succeeds, the Kind property of the returned DateTime value is DateTimeKind.Unspecified."
- **[D13] Global Query Filters** - https://learn.microsoft.com/en-us/ef/core/querying/filters
  > "Using required navigation to access entity which has global query filter defined may lead to unexpected results."

  > "Required navigations in EF imply that the related entity is always present. Since inner joins may be used to fetch related entities, if a required related entity is filtered out by the query filter, the parent entity may get filtered out as well. This can result in unexpectedly retrieving fewer elements than expected."

  > "Filters may be disabled for individual LINQ queries by using the IgnoreQueryFilters operator"
- **[D14] Cascade Delete** - https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete
  > "By convention, this relationship is configured as a required, since the `Post.BlogId` foreign key property is non-nullable. Required relationships are configured to use cascade deletes by default."

  > "EF Core always applies configured cascading behaviors to tracked entities."

  > "Do not configure cascade delete in the database when soft-deleting entities. This may cause entities to be accidentally really deleted instead of soft-deleted."

  > (пример с `blog.Posts.Clear();`) "In either case the result is the same: the blog is not deleted, but the posts that are no longer associated with any blog are deleted"

  Таблица "Required relationship with dependents/children loaded", столбец "On severing from principal/parent": "Cascade - Dependents deleted by EF Core", "Restrict - `InvalidOperationException`", "NoAction - `InvalidOperationException`".

  Таблица "Impact on database schema": "Cascade - ON DELETE CASCADE". Таблица "Required relationship with dependents/children not loaded": "Cascade - Dependents deleted by database".
- **[D15] Single vs. Split Queries** - https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries
  > "When using split queries with Skip/Take on EF versions prior to 10, pay special attention to making your query ordering fully unique; not doing so could cause incorrect data to be returned. For example, if results are ordered only by date, but there can be multiple results with the same date, then each one of the split queries could get different results from the database. Ordering by both date and ID (or any other unique property or combination of properties) makes the ordering fully unique and avoids this problem."

  > "When split queries are configured as the default, it's still possible to configure specific queries to execute as single queries"
- **[D16] Managing Migrations** - https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing
  > "EF Core is generally unable to know when the intention is to drop a column and create a new one (two separate changes), and when a column should be renamed. If the above migration is applied as-is, all your customer names will be lost."

  > "When replacing columns, preserve the source data until the destination has been populated: 1. Add the destination column as nullable. 2. Populate it from the existing columns. 3. Make the destination column required, if appropriate. 4. Drop the source columns."
- **[D17] Applying Migrations** - https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying
  > "Whatever your deployment strategy, always inspect the generated migrations and test them before applying to a production database. A migration may drop a column when the intent was to rename it, or may fail for various reasons when applied to a database."
- **[D18] Tutorial: Create a complex data model (EF Core)** - https://learn.microsoft.com/en-us/aspnet/core/data/ef-mvc/complex-data-model?view=aspnetcore-8.0
  > "The generated code in the `Up` method adds a non-nullable `DepartmentID` foreign key to the `Course` table. If there are already rows in the Course table when the code runs, the `AddColumn` operation fails [...] in a production application you'd have to make the migration handle existing data"

  > "To make this migration work with existing data you have to change the code to give the new column a default value, and create a stub department named "Temp" to act as the default department."

  (сгенерированный код в туториале: `migrationBuilder.AddColumn<int>(name: "DepartmentID", table: "Course", nullable: false, defaultValue: 0);`)
- **[D19] PostgreSQL 16, ALTER TABLE** - https://www.postgresql.org/docs/16/sql-altertable.html
  > "Normally, this form will cause a scan of the table to verify that all existing rows in the table satisfy the new constraint."
- **[D20] PostgreSQL 16, CREATE INDEX** - https://www.postgresql.org/docs/16/sql-createindex.html
  > "UNIQUE: Causes the system to check for duplicate values in the table when the index is created (if data already exist) and each time data is added."
- **[D21] PostgreSQL 16, Date/Time Types** - https://www.postgresql.org/docs/16/datatype-datetime.html
  > "Conversions between `timestamp without time zone` and `timestamp with time zone` normally assume that the `timestamp without time zone` value should be taken or given as `timezone` local time."
- **[D22] Collations and Case Sensitivity** - https://learn.microsoft.com/en-us/ef/core/miscellaneous/collations-and-case-sensitivity
  > "By design, EF Core refrains from translating these overloads to SQL, and attempting to use them will result in an exception." (про `string.Equals(..., StringComparison)`; относится к вариантам решения K4(а) и K1(а) со StringComparison.)
- **[D23] Npgsql Translations** - https://www.npgsql.org/efcore/mapping/translations.html
  > "EF.Functions.ILike(matchExpression, pattern) | matchExpression ILIKE pattern"

## Строки ключа

| Строка | Опора | Как применяется |
| --- | --- | --- |
| K1-overdue-filter | D2, D1 | `IsOverdue`/`OverdueDays` без сеттера не входят в модель (D2); выражение в `Where`/`OrderBy`, не являющееся top-level проекцией, не транслируется -> исключение (D1). |
| K1-export-mask | D4 | Сущности отслеживаются по умолчанию, изменения (`MaskContacts`) сохраняются при `SaveChanges` для `ExportLog`. |
| K1-period-utc | D8, D9, D10 | `IssuedAt` -> `timestamptz` по умолчанию; `DateOnly.ToDateTime(TimeOnly)` даёт Unspecified; отправка non-UTC в `timestamptz` (в т.ч. параметром запроса) бросает исключение. |
| K1-h-card-single | D6 | Single бросает только при >1 совпадении; уникальный индекс `CardNumber` исключает это. |
| K1-m-global-notracking | D4 | Глобальный NoTracking: `ReturnAsync` меняет сущность из запроса, которая больше не отслеживается, `SaveChanges` её не сохраняет. |
| K2-checkin-phone | D6 | Несколько клиентов с одним телефоном -> `InvalidOperationException` у Single/SingleOrDefault. |
| K2-replace-sessions | D14 | Required + Restrict, зависимые загружены, разрыв связи -> `InvalidOperationException`. |
| K2-screen-next | D15 | Порядок только по `StartsAt` (дата-время, у параллельных занятий совпадает) + Take(1)/First в split-режиме, EF 8 < 10. `First`/`FirstOrDefault` транслируются в `LIMIT 1`, как и `Take(1)`; документация формулирует предупреждение для Skip/Take - распространение на First вывод, а не цитата. |
| K2-h-course-split | D15 | Предупреждение касается неуникального порядка; фильтр по PK даёт ровно одну строку, совпадающую во всех split-запросах. |
| K2-m-cascade | D14 | Cascade -> ON DELETE CASCADE, незагруженные зависимые удаляются БД; Enrollment->Session required, каскад по умолчанию. |
| K3-greenhouse-fk | D18, D19, D16, D17 | Сгенерированный `AddColumn<int>(nullable: false, defaultValue: 0)` + FK падает на таблице с данными (D18, D19); безопасный порядок - nullable -> заполнить -> required (D16). |
| K3-label-filter | D7 | Значение пользователя, вставленное в строку FromSqlRaw, - инъекция; значения передавать DbParameter. |
| K3-takenat-fallback | D8, D9 | Колонка явно `timestamp without time zone`; Kind=Utc в `timestamp` не пишется (D8), Local/Unspecified - пишется (D9). |
| K3-h-raw-safe-parts | D7 | Опасна вставка значений из небезопасного источника; `orderBy` выбирается из `switch`, `int` и `enum` не несут пользовательского текста. |
| K3-m-timestamptz | D21 | Преобразование `timestamp` -> `timestamptz` трактует значения в зоне сессии (TimeZone), без `AT TIME ZONE` местное время площадки сдвигается. |
| K4-tag-filter | D3, D1 | `Tags` - свойство с value converter; обращение к членам сконвертированного типа (`Contains`, `SelectMany`) в запросе невозможно -> исключение трансляции (D1). |
| K4-delete-hours | D14, D13 | Каскад применяется к отслеживаемым зависимым (D14); пример override из D13 переводит в soft-delete только перечисленные типы; D14 предупреждает о реальном удалении при soft-delete с каскадом. |
| K4-closed-update | D5 | Запрос + `Update` нового экземпляра с тем же ключом -> `InvalidOperationException ... already being tracked`. |
| K4-h-ilike | D1, D23 | Захваченные переменные становятся параметрами (D1); `ILike` транслируется в `ILIKE pattern` (D23). |
| K5-checkin-email | D6 | Уникальность только по (EventId, Email); у участника нескольких мероприятий Single бросает. |
| K5-revenue-hall | D13 | Обязательная навигация к сущности с фильтром -> INNER JOIN, строки с отфильтрованным залом выпадают. Пример документации - `Include`; для `Select`/`GroupBy` по навигации действует та же формулировка "inner joins may be used to fetch related entities" (вывод). Лечится `IgnoreQueryFilters`. |
| K5-program-latest | D15 | Порядок только по дате (`DateOnly PublishedOn`), версии одного дня совпадают -> split-запросы могут выбрать разные строки. Документация приводит ровно этот пример ("ordered only by date"). Оговорка про First = Take(1) - как в K2-screen-next. |
| K5-h-register-single | D6 | Условие совпадает с уникальным индексом (EventId, Email). |
| K6-sort-column | D7 | Имена столбцов не параметризуются; при динамической сборке ответственность за безопасность строки на коде (белый список). |
| K6-total-count | D7 | Компоновка поверх FromSqlRaw делает SQL подзапросом; `COUNT` над подзапросом с `LIMIT/OFFSET` считает только страницу. |
| K6-account-index | D20, D17 | `CREATE UNIQUE INDEX` проверяет существующие строки и падает на дублях; миграция "may fail ... when applied to a database". |
| K6-plan-replace | D14 | `Clear()` на required + Cascade -> сироты удаляются EF; `PlanItem->PlanItemCompletion` с ON DELETE CASCADE удаляет незагруженные отметки в БД. |
| K6-h-limit | D7 | Опасны значения из небезопасного источника; `pageSize`/`offset` - вычисленные `int`. |
| K6-m-dedup-delete | D14 | `ServiceRequest.ApartmentId` - non-nullable FK, required -> каскад по умолчанию -> ON DELETE CASCADE. |
| KR-rename-drop | D16, D17 | Переименование, сгенерированное как Drop+Add, теряет данные; использовать `RenameColumn`. |
| KR-permits-clear | D14 | Required + NoAction, зависимые загружены (`Include`), разрыв связи -> `InvalidOperationException`. |
| KR-search-inject | D7 | Значение в строке FromSqlRaw; экранирование LIKE-символов не нейтрализует кавычку. |
| KR-offday-filter | D1 | Пользовательский метод `WorkCalendar.IsWorkingDay` в `Where` не транслируется -> исключение. |
| KR-plate-single | D6 | Частичный уникальный индекс (`HasFilter`) не исключает совпадения номера у списанной и действующей машины. |
| KR-import-kind | D12, D8, D9 | `ParseExact` без зоны -> Unspecified; `StartedAt` -> `timestamptz`; non-UTC в `timestamptz` -> исключение. |
| KR-h-utc-bounds | D8 | Kind=Utc - единственный допустимый Kind для `timestamptz`. |
| KN-h-datetime | D11, D8, D9, D10 | `.Date` сохраняет Kind=Utc; `ToDateTime(TimeOnly)` даёт Unspecified, а `PlannedLocal` явно `timestamp without time zone`, куда Unspecified пишется. |
| KN-h-card-split | D15 | Предупреждение относится к неуникальному порядку при Skip/Take; выборка по PK однозначна. Оговорка о согласованности при конкурентных изменениях (тот же документ, "no such guarantees exist for multiple queries") - не дефект корректности этого кода. |
| KN-h-inanalysis-tracking | D4 | Изменения сохраняются только у отслеживаемых сущностей; `CloseAsync` меняет пробы, полученные из репозитория. |
| KN-h-fromsql | D7 | `FromSql` с интерполяцией передаёт значения как DbParameter. |
| KN-h-retag-clear | D14 | Required + Cascade (по умолчанию), зависимые загружены -> при `Clear()` "Dependents deleted by EF Core". |
| KN-h-labcode-single | D6 | `LabCode` покрыт уникальным индексом. |
