# Сверка строк ключа с документацией

Документация проверена 2026-10-02 (learn.microsoft.com, npgsql.org, postgresql.org). Цитаты дословные.
Строки `coverage` не опираются на поведение EF Core / Npgsql и здесь не приводятся.
Раунд 2: кейсы K1-K6 и KR переписаны, источники D24-D41 добавлены; D1-D23 сохранены (на них опираются KN и новые строки).

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

  > "EF Core supports doing client evaluation in the top-level projection."
- **[D5] Identity Resolution** - https://learn.microsoft.com/en-us/ef/core/change-tracking/identity-resolution
  > "System.InvalidOperationException: The instance of entity type 'Blog' cannot be tracked because another instance with the key value '{Id: 1}' is already being tracked."
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

  > "It is no longer possible to write DateTimeOffset with offsets other than 0 (UTC), since these cannot be represented in PostgreSQL."
- **[D9] Npgsql Date and Time Handling** - https://www.npgsql.org/doc/types/datetime.html
  > "Starting with 6.0, Npgsql maps UTC DateTime to `timestamp with time zone`, and Local/Unspecified DateTime to `timestamp without time zone`; trying to send a non-UTC DateTime as `timestamptz` will throw an exception"

  > "Npgsql also supports reading and writing DateTimeOffset to `timestamp with time zone`, but only with Offset=0."

  Таблица отправки: `timestamp without time zone` - "DateTime (Local/Unspecified)".
- **[D10] DateOnly.ToDateTime(TimeOnly)** - https://learn.microsoft.com/en-us/dotnet/api/system.dateonly.todatetime
  > "The Kind property of the resulting DateTime is initialized to DateTimeKind.Unspecified."
- **[D11] DateTime.Date** - https://learn.microsoft.com/en-us/dotnet/api/system.datetime.date
  > "The value of the Kind property of the returned DateTime value is the same as that of the current instance."
- **[D12] DateTime.ParseExact** - https://learn.microsoft.com/en-us/dotnet/api/system.datetime.parseexact
  > "If `s` does not represent a time in a particular time zone and the parse operation succeeds, the Kind property of the returned DateTime value is DateTimeKind.Unspecified."
- **[D13] Global Query Filters** - https://learn.microsoft.com/en-us/ef/core/querying/filters
  > "Required navigations in EF imply that the related entity is always present. Since inner joins may be used to fetch related entities, if a required related entity is filtered out by the query filter, the parent entity may get filtered out as well."

  > "Filters may be disabled for individual LINQ queries by using the IgnoreQueryFilters operator"

  > (пример) "you can override your context type's `SaveChangesAsync` method to add logic which goes over all entities which the user deleted, and changes them to be modified instead, setting the `IsDeleted` property to true"
- **[D14] Cascade Delete** - https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete
  > "By convention, this relationship is configured as a required, since the `Post.BlogId` foreign key property is non-nullable. Required relationships are configured to use cascade deletes by default."

  > "EF Core always applies configured cascading behaviors to tracked entities."

  > "Do not configure cascade delete in the database when soft-deleting entities. This may cause entities to be accidentally really deleted instead of soft-deleted."

  > (пример с `blog.Posts.Clear();`) "In either case the result is the same: the blog is not deleted, but the posts that are no longer associated with any blog are deleted"

  > "Databases don't typically have any way to automatically delete orphans. [...] This means that it is usually not possible to sever a relationship without loading both sides into the DbContext."

  Таблица "Required relationship with dependents/children loaded", столбец "On severing from principal/parent": "Cascade - Dependents deleted by EF Core". Таблица "Required relationship with dependents/children not loaded": "Cascade - Dependents deleted by database" (при удалении principal), для разрыва связи - "N/A", примечание "Severing a relationship is not valid here since the dependents/children are not loaded." Таблица "Impact on database schema": "Cascade - ON DELETE CASCADE".
- **[D15] Single vs. Split Queries** - https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries
  > "When using split queries with Skip/Take on EF versions prior to 10, pay special attention to making your query ordering fully unique; not doing so could cause incorrect data to be returned. For example, if results are ordered only by date, but there can be multiple results with the same date, then each one of the split queries could get different results from the database. Ordering by both date and ID (or any other unique property or combination of properties) makes the ordering fully unique and avoids this problem."

  > "When split queries are configured as the default, it's still possible to configure specific queries to execute as single queries"
- **[D16] Managing Migrations** - https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing
  > "When replacing columns, preserve the source data until the destination has been populated"
- **[D17] Applying Migrations** - https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying
  > "Whatever your deployment strategy, always inspect the generated migrations and test them before applying to a production database. A migration may drop a column when the intent was to rename it, or may fail for various reasons when applied to a database."
- **[D18]-[D19], [D21]-[D23]** - источники раунда 1 (туториал о NOT NULL FK, PostgreSQL ALTER TABLE ADD CONSTRAINT, PostgreSQL Date/Time Types, Collations, Npgsql ILike); в ключах раунда 2 не используются, кроме D22 (ниже).
- **[D20] PostgreSQL 16, CREATE INDEX** - https://www.postgresql.org/docs/16/sql-createindex.html
  > "UNIQUE: Causes the system to check for duplicate values in the table when the index is created (if data already exist) and each time data is added."
- **[D22] Collations and Case Sensitivity** - https://learn.microsoft.com/en-us/ef/core/miscellaneous/collations-and-case-sensitivity
  > "while some databases are case-sensitive by default (e.g. Sqlite, PostgreSQL), others are case-insensitive (SQL Server, MySQL)"

  > "C# equality is translated directly to SQL equality, which may or may not be case-sensitive, depending on the specific database in use and its collation configuration."

  > "By design, EF Core refrains from translating these overloads to SQL, and attempting to use them will result in an exception." (про `string.Equals(..., StringComparison)`)
- **[D24] ExecuteUpdate and ExecuteDelete** - https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete
  > "ExecuteUpdate and ExecuteDelete are a way to save data to the database without using EF's traditional change tracking and SaveChanges() method."

  > "In fact, the functions are completely unaware of EF's change tracker, and have no interaction with it whatsoever."
- **[D25] Tracking queries and already tracked entities** - https://learn.microsoft.com/en-us/ef/core/querying/tracking
  > "When the results are returned in a tracking query, EF Core checks if the entity is already in the context. If EF Core finds an existing entity, then the same instance is returned, which can potentially use less memory and be faster than a no-tracking query. EF Core doesn't overwrite current and original values of the entity's properties in the entry with the database values."

  > "A no-tracking query also give results based on what's in the database disregarding any local changes or added entities."
- **[D26] DbContext Lifetime** - https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/
  > "A `DbContext` instance is designed to be used for a *single* unit-of-work. This means that the lifetime of a `DbContext` instance is usually very short."
- **[D27] Comparisons with null values in queries** - https://learn.microsoft.com/en-us/ef/core/querying/null-comparisons
  > "When translating LINQ queries to SQL, EF Core tries to compensate for the difference by introducing additional null checks for some elements of the query."

  Пример для двух nullable-операндов `e.String1 == e.String2`: "WHERE ([e].[String1] = [e].[String2]) OR ([e].[String1] IS NULL AND [e].[String2] IS NULL)".
- **[D28] Npgsql Indexes, nulls distinct** - https://www.npgsql.org/efcore/modeling/indexes.html
  > "By default, when you create a unique index, PostgreSQL treats null values as distinct; this means that a unique index can contain multiple null values in a column."
- **[D29] Global Query Filters, multiple filters** - https://learn.microsoft.com/en-us/ef/core/querying/filters
  > "Prior to EF 10, you can attach multiple filters to an entity type by calling HasQueryFilter once and combining your filters using the `&&` operator"

  > "This unfortunately does not allow to selectively disable a single filter."

  > "This feature is being introduced in EF Core 10.0 (in preview)." (именованные фильтры)
- **[D30] Changing Foreign Keys and Navigations, delete orphans timing** - https://learn.microsoft.com/en-us/ef/core/change-tracking/relationship-changes
  > "It is also possible to turn off automatic deletion of orphans. This will result in an exception if SaveChanges is called while an orphan is being tracked."

  > "System.InvalidOperationException: The association between entities 'Blog' and 'Post' with the key value '{BlogId: 1}' has been severed, but the relationship is either marked as required or is implicitly required because the foreign key is not nullable."

  > "However, if as in the example above, post is associated with a new blog before SaveChanges is called, then it will be fixed up appropriately to that new blog and is no longer considered an orphan"
- **[D31] SQL Queries, limitations and composition** - https://learn.microsoft.com/en-us/ef/core/querying/sql-queries
  > "The SQL query must return data for all properties of the entity type."

  > "The column names in the result set must match the column names that properties are mapped to."

  > "Composing with LINQ requires your SQL query to be composable, since EF Core will treat the supplied SQL as a subquery. Composable SQL queries generally begin with the `SELECT` keyword, and cannot contain SQL features that aren't valid in a subquery, such as: A trailing semicolon"
- **[D32] Model Bulk Configuration, pre-convention configuration** - https://learn.microsoft.com/en-us/ef/core/modeling/bulk-configuration
  > "EF Core allows the mapping configuration to be specified once for a given CLR type; that configuration is then applied to all properties of that type in the model as they are discovered."
- **[D33] PostgreSQL 16, Current Date/Time** - https://www.postgresql.org/docs/16/functions-datetime.html
  > "Since these functions return the start time of the current transaction, their values do not change during the transaction. This is considered a feature: the intent is to allow a single transaction to have a consistent notion of the "current" time, so that multiple modifications within the same transaction bear the same time stamp."
- **[D34] EF Core Transactions** - https://learn.microsoft.com/en-us/ef/core/saving/transactions
  > "By default, if the database provider supports transactions, all changes in a single call to `SaveChanges` are applied in a transaction."
- **[D35] PostgreSQL 16, Character Types** - https://www.postgresql.org/docs/16/datatype-character.html
  > "An attempt to store a longer string into a column of these types will result in an error, unless the excess characters are all spaces, in which case the string will be truncated to the maximum length."
- **[D36] PostgreSQL 16, ALTER TABLE ... SET DATA TYPE** - https://www.postgresql.org/docs/16/sql-altertable.html
  > "The optional `USING` clause specifies how to compute the new column value from the old; if omitted, the default conversion is the same as an assignment cast from old data type to new."
- **[D37] EF Core Indexes** - https://learn.microsoft.com/en-us/ef/core/modeling/indexes
  > "Attempting to insert more than one entity with the same values for the index's column set will cause an exception to be thrown."

  > "You can use the Fluent API to specify a filter on an index, provided as a SQL expression"
- **[D38] Npgsql Translations** - https://www.npgsql.org/efcore/mapping/translations.html
  Строки таблицы: "`EF.Functions.Random()` → `random()`", "`Guid.NewGuid()` → `gen_random_uuid()` or `uuid_generate_v4()`".
- **[D39] PostgreSQL 16, SELECT, FROM clause** - https://www.postgresql.org/docs/16/sql-select.html
  > "A substitute name for the `FROM` item containing the alias. An alias is used for brevity or to eliminate ambiguity for self-joins (where the same table is scanned multiple times)."

  > "When an alias is provided, it completely hides the actual name of the table or function; for example given `FROM foo AS f`, the remainder of the `SELECT` must refer to this `FROM` item as `f` not `foo`."
- **[D40] TimeZoneInfo.ConvertTimeToUtc(DateTime, TimeZoneInfo)** - https://learn.microsoft.com/en-us/dotnet/api/system.timezoneinfo.converttimetoutc
  > "The Coordinated Universal Time (UTC) that corresponds to the `dateTime` parameter. The DateTime object's Kind property is always set to Utc."
- **[D41] DateTimeOffset(DateTime) constructor** - https://learn.microsoft.com/en-us/dotnet/api/system.datetimeoffset.-ctor
  > "If the value of DateTime.Kind is DateTimeKind.Utc, the DateTime property of the new instance is set equal to `dateTime`, and the Offset property is set equal to Zero."

## Строки ключа

| Строка | Опора | Как применяется |
| --- | --- | --- |
| K1-debtors-fine | D1, D4 | `Fines.*` - пользовательские методы; в конечной проекции EF исполняет их на клиенте (D4), в `Where`/`OrderBy`/агрегате после `ToLoanRows()` выражение уже не top-level projection - исключение (D1). |
| K1-period-offset | D8, D9 | `Loan.IssuedAt` - `DateTimeOffset` -> `timestamptz`; запись (в т.ч. параметра запроса) `DateTimeOffset` со смещением, отличным от 0, Npgsql не выполняет. Отбрасывание смещения без пересчёта сдвигает момент - вывод. |
| K1-h-loanrows | D4, D1 | Клиентская оценка в top-level projection поддерживается; исключение только вне неё. |
| K1-h-today-utc | D40, D41, D9 | `ConvertTimeToUtc` даёт Kind=Utc, `new DateTimeOffset(utc)` - смещение 0, что Npgsql пишет в `timestamptz`. |
| K2-freeze-fresh | D25, D26, D4 | Контекст TurnstileWorker живёт всё время работы сервиса (против D26); отслеживающий запрос возвращает уже отслеживаемый `Member` без перезаписи значений из БД (D25); no-tracking запрос даёт значения из БД. |
| K2-random-session | D15, D38 | `random()`/`gen_random_uuid()` дают порядок, неуникальный между split-запросами (крайний случай "ordering fully unique" из D15); документация формулирует предупреждение для Skip/Take, `First`/`FirstOrDefault` = `LIMIT 1` - вывод. |
| K2-h-course-split | D15 | Фильтр по PK даёт одну и ту же строку во всех split-запросах. |
| K2-m-passes-notracking | D4 | Без отслеживания изменения `ProcessedAt`/`Status` не попадают в `SaveChanges`. |
| K3-contract-null | D27, D28, D6 | EF сохраняет семантику C# (`null == null` - истина), сравнение с null-параметром совпадает со строками, где `contract_no IS NULL` (D27, вывод для параметра из примера с двумя nullable-операндами); уникальный индекс допускает много NULL (D28); `Single*` при нескольких совпадениях бросает (D6). |
| K3-credit-time | D32, D8, D9 | `ConfigureConventions` задаёт `timestamp without time zone` всем `DateTime` (D32); Kind=Utc в `timestamp` не пишется (D8), Local/Unspecified - пишется (D9). |
| K3-h-bycontract | D6, D28 | Непустой номер из маршрута совпадает не более чем с одной строкой: NULL-исключение D28 к нему не относится. |
| K3-m-utcnow | D32, D8 | Те же колонки `timestamp without time zone`; Kind=Utc отклоняется. |
| K4-year-closed | D3, D1 | `ClosedPeriod.Month` - value object с `HasConversion`; обращение к его членам (`Month.Year`) в запросе невозможно (D3) -> исключение (D1). |
| K4-h-month-equality | D3, D1 | Ограничение D3 касается обращения к членам; сравнение значения целиком параметризуется (D1 о параметрах) и проходит через конвертер - вывод. |
| K4-client-projects | D24, D13, D14 | `ExecuteDelete` работает мимо change tracker и `SaveChanges` (D24), значит override мягкого удаления (образец D13) не срабатывает; в БД `ON DELETE CASCADE` удаляет записи времени (D14, предупреждение о каскаде при soft-delete). Вариант с `Include`: EF каскадно помечает отслеживаемые записи Deleted (D14), override переводит в мягкое удаление только `ISoftDeletable`. |
| K4-code-index | D20, D13, D37, D17 | Глобальный фильтр скрывает удалённые проекты только от запросов (D13), `CREATE UNIQUE INDEX` проверяет все существующие строки (D20) - на дублях с удалёнными миграция падает (D17). Частичный индекс - `HasFilter` (D37). |
| K5-login-email | D22, D6 | PostgreSQL регистрозависим по умолчанию, равенство C# -> равенство SQL: уникальный индекс не мешает существованию «Ivan@…» и «ivan@…»; сравнение без учёта регистра находит обе, `Single*` бросает (D6). |
| K5-graduates-school | D29, D13 | В EF 8 фильтр сущности один (комбинация через `&&`), выборочно не отключается (D29); `IgnoreQueryFilters` снимает фильтры запроса целиком (D13), включая условие по SchoolId. |
| K5-instructor-list | D4 | Сущности отслеживаются по умолчанию, изменения сохраняются `SaveChanges`, который вызывает `SaveChangesFilter` после обработчика. |
| K5-h-find-exact | D6, D22 | Точное равенство + фильтр по школе совпадает с уникальным индексом (SchoolId, Email). |
| K5-m-notracking | D4 | Глобальный NoTracking: изменения сущностей из запросов не видны `SaveChanges`. |
| K6-sort-alias | D39, D7 | Ссылаться в `ORDER BY` можно только на FROM-элементы запроса по их алиасам (D39); при отсутствии JOIN алиас `h`/`a` не определён. Два FROM-элемента с одним алиасом - неоднозначность, которую алиасы и призваны устранять (D39) - вывод; PostgreSQL отвергает такой запрос. Безопасность динамической части - на коде (D7). |
| K6-search-columns | D31 | Результат `FromSqlRaw` должен содержать данные для всех свойств сущности с именами замапленных колонок. |
| K6-plan-orphans | D30, D14 | При `DeleteOrphansTiming = Never` разрыв обязательной связи без явного удаления - `InvalidOperationException` (D30); удаление всех `PlanItem` каскадом удаляет `PlanItemCompletion` (D14). |
| K6-h-move-items | D30 | Сущность, привязанная к новому родителю до `SaveChanges`, сиротой не считается. |
| K6-h-limit | D7 | Опасны значения из небезопасного источника; `pageSize`/`offset` - вычисленные `int`. |
| KR-offday-rows | D1, D4 | `OffDay` = клиентский `WorkCalendar.IsWorkingDay` в проекции; `Where(r => r.OffDay)` после `ToRows()` - вне top-level projection -> исключение. |
| KR-open-semicolon | D31, D7 | Композиция `Where` поверх `FromSqlRaw` делает SQL подзапросом; завершающая `;` недопустима в подзапросе. Без композиции SQL исполняется как есть - вывод из D7/D31. |
| KR-equipment-clear | D14, D37 | Без загрузки зависимых разрыв связи невозможен (D14: "N/A", "usually not possible to sever a relationship without loading both sides"); новые позиции с теми же кодами нарушают уникальный индекс (D37). |
| KR-model-length | D36, D35, D17 | Смена типа без `USING` = присваивающее приведение (D36); строка длиннее `varchar(n)` при сохранении даёт ошибку (D35); миграция падает на prod (D17). |
| KR-last-inspection | D15, D33, D34 | Порядок по `CreatedAt` неуникален: `now()` - время начала транзакции (D33), осмотры пачки пишутся одним `SaveChanges` в одной транзакции (D34); при split-запросах неуникальный порядок даёт данные разных строк (D15). |
| KR-h-permits-clear | D14 | Required + Cascade (по умолчанию), зависимые загружены -> "Dependents deleted by EF Core". |
| KR-h-plate-fromsql | D7, D31 | `FromSql` с интерполяцией передаёт значение параметром; SQL без `;` компонуется. |
| KN-h-datetime | D11, D8, D9, D10 | `.Date` сохраняет Kind=Utc; `ToDateTime(TimeOnly)` даёт Unspecified, а `PlannedLocal` явно `timestamp without time zone`, куда Unspecified пишется. |
| KN-h-card-split | D15 | Предупреждение относится к неуникальному порядку при Skip/Take; выборка по PK однозначна. |
| KN-h-inanalysis-tracking | D4 | Изменения сохраняются только у отслеживаемых сущностей; `CloseAsync` меняет пробы, полученные из репозитория. |
| KN-h-fromsql | D7 | `FromSql` с интерполяцией передаёт значения как DbParameter. |
| KN-h-retag-clear | D14 | Required + Cascade (по умолчанию), зависимые загружены -> при `Clear()` "Dependents deleted by EF Core". |
| KN-h-labcode-single | D6 | `LabCode` покрыт уникальным индексом. |
