# Сверка строк ключа с документацией

Источники проверены 2026-10-02 через WebFetch. Цитаты даны дословно, на языке оригинала. В каждом
кейсе сначала идут строки `unit` и `harm`, затем строки `coverage`, которые опираются на поведение
.NET / ASP.NET Core. Строки `coverage`, в которых нет поведения платформы (бизнес-правила, авторизация,
порядок шагов), сверки с документацией не требуют.

## V1

### V1-seasonal-rates-not-loaded (unit: related-data-loading)
- https://learn.microsoft.com/en-us/ef/core/querying/related-data/
  > "**Eager loading** means that the related data is loaded from the database as part of the initial query."
- https://learn.microsoft.com/en-us/ef/core/querying/related-data/lazy
  > "The simplest way to use lazy-loading is by installing the Microsoft.EntityFrameworkCore.Proxies package and enabling it with a call to `UseLazyLoadingProxies`."
  > "EF Core will then enable lazy loading for any navigation property that can be overridden--that is, it must be `virtual` and on a class that can be inherited from."

  В кейсе прокси не подключены (Program.cs), навигации не `virtual`, значит ленивой загрузки нет.
- https://learn.microsoft.com/en-us/ef/core/querying/sql-queries
  > "The SQL query can't contain related data. However, in many cases you can compose on top of the query using the `Include` operator to return related data"
  > "The `Include` operator can be used to load related data, just like with any other LINQ query"

### V1-h-fromsql-interpolated (harm: raw-sql-parameters)
- https://learn.microsoft.com/en-us/ef/core/querying/sql-queries
  > "While this syntax may look like regular C# string interpolation, the supplied value is wrapped in a `DbParameter` and the generated parameter name inserted where the `{0}` placeholder was specified. This makes FromSql safe from SQL injection attacks"
  > "The FromSql and FromSqlInterpolated methods are safe against SQL injection, and always integrate parameter data as a separate SQL parameter."
  > "You can compose on top of the initial SQL query using LINQ operators; EF Core will treat your SQL as a subquery and compose over it in the database."

### V1-h-xmin-timestamp (harm: concurrency-token)
- https://www.npgsql.org/efcore/modeling/concurrency.html
  ```csharp
  public class SomeEntity
  {
      public int Id { get; set; }

      [Timestamp]
      public uint Version { get; set; }
  }
  ```
  > "All PostgreSQL tables have a set of implicit and hidden system columns" … `xmin` "automatically gets updated every time the row is changed."

### V1-h-dateonly-mapping (harm: provider-type-mapping)
- https://www.npgsql.org/doc/types/datetime.html - таблица «Sending values to the database»:
  > "date | DateOnly (6.0+) | DateTime"

  Таблица «Reading values from the database»:
  > "date | DateOnly … | DateTime"

### V1-kopecks-cast (coverage, поведение C#)
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/ - таблица приоритетов:
  в строке «Unary» есть `(T)x`, а «Multiplicative» (`x * y`) идёт ниже.
  > "In an expression with multiple operators, the operators with higher precedence are evaluated before the operators with lower precedence."
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/numeric-conversions
  > "When you convert a `decimal` value to an integral type, this value is rounded toward zero to the nearest integral value."

  Отсюда: `(long)rubles * 100` сначала обрезает рубли до целого (3703,65 → 3703), потом умножает.

### V1-tariff-singleton-state (coverage, поведение DI)
- https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection/service-lifetimes
  > "Every subsequent request of the service implementation from the dependency injection container uses the same instance."
  > "Register singleton services with AddSingleton. Singleton services must be thread safe and are often used in stateless services."

  `TariffCalculator` зарегистрирован `AddSingleton` и хранит изменяемый `List<NightCharge>` в поле.

## V2

### V2-parallel-dbcontext (unit: dbcontext-concurrency)
- https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/
  > "Entity Framework Core does not support multiple parallel operations being run on the same `DbContext` instance. This includes both parallel execution of async queries and any explicit concurrent use from multiple threads. Therefore, always `await` async calls immediately, or use separate `DbContext` instances for operations that execute in parallel."
  > "When EF Core detects an attempt to use a `DbContext` instance concurrently, you'll see an `InvalidOperationException` with a message like this: A second operation started on this context before a previous operation completed."

### V2-string-equals-comparison (unit: query-translation)
- https://learn.microsoft.com/en-us/ef/core/miscellaneous/collations-and-case-sensitivity
  > "In addition, .NET provides overloads of `string.Equals` accepting a `StringComparison` enum, which allows specifying case-sensitivity and a culture for the comparison. By design, EF Core refrains from translating these overloads to SQL, and attempting to use them will result in an exception."

### V2-h-collection-replace-orphans (harm: orphan-deletion)
- https://learn.microsoft.com/en-us/ef/core/change-tracking/relationship-changes
  > "Setting the FK value to null is not allowed (and is usually not possible) for required relationships. Therefore, severing a required relationship means that the dependent/child entity must be either re-parented to a new principal/parent, or removed from the database when SaveChanges is called to avoid a referential constraint violation. This is known as "deleting orphans", and is the default behavior in EF Core for required relationships."
- https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete - таблица «Required relationship with dependents/children loaded»:
  > "Cascade | Dependents deleted by EF Core | Dependents deleted by EF Core"
  > "The default for required relationships like this is `Cascade`."

  В кейсе старые `ReviewScore` загружены через `Include(r => r.Scores)`, `ReviewId` - non-nullable
  `int`.

### V2-h-filtered-include (harm: filtered-include)
- https://learn.microsoft.com/en-us/ef/core/querying/related-data/eager
  > "When applying Include to load related data, you can add certain enumerable operations to the included collection navigation, which allows for filtering and sorting of the results. Supported operations are: `Where`, `OrderBy`, `OrderByDescending`, `ThenBy`, `ThenByDescending`, `Skip`, and `Take`."
  > "In case of tracking queries, results of Filtered Include may be unexpected due to navigation fixup. … Consider using `NoTracking` queries"

  В кейсе запрос `AsNoTracking`.

### V2-h-executeupdate-in-transaction (harm: bulk-update)
- https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete
  > "`ExecuteUpdate` and `ExecuteDelete` work quite differently: they take effect immediately, at the point in which they are invoked."
  > "it's important to understand that `ExecuteUpdate` and `ExecuteDelete` do not implicitly start a transaction when they're invoked. … To wrap multiple operations in a single transaction, explicitly start a transaction with DatabaseFacade"

### V2-csv-culture (coverage, поведение .NET / ASP.NET Core)
- https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/tokens/interpolated
  > "By default, an interpolated string uses the current culture defined by the CultureInfo.CurrentCulture property for all formatting operations."
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/localization/select-language-culture
  > "The current culture on a request is set in the localization Middleware."
  > "If none of the providers can determine the request culture, the DefaultRequestCulture is used."

  В Program.cs поддерживается единственная культура ru-RU, она же культура по умолчанию.
- https://learn.microsoft.com/en-us/dotnet/api/system.decimal.tostring - пример ToString(IFormatProvider):
  > "// Display value using the de-DE culture." … "-16325,62"

  Пример показывает десятичную запятую в европейской культуре. В ru-RU десятичный разделитель тоже
  запятая, поэтому `87.5m` в интерполяции даёт `87,5`.

## V3

### V3-promo-notracking (unit: change-tracking)
- https://learn.microsoft.com/en-us/ef/core/querying/tracking
  > "Tracking behavior controls if Entity Framework Core keeps information about an entity instance in its change tracker. If an entity is tracked, any changes detected in the entity are persisted to the database during `SaveChanges`."
  > "No-tracking queries are useful when the results are used in a read-only scenario."

### V3-unspecified-timestamptz (unit: npgsql-datetime)
- https://www.npgsql.org/efcore/release-notes/6.0.html
  > "It is no longer possible to write DateTime with Kinds Local or Unspecified to `timestamptz` properties (which are the default for DateTime)."
  > "DateTime properties now map to `timestamptz` by default, instead of to `timestamp`"
- https://www.npgsql.org/doc/types/datetime.html
  > "trying to send a non-UTC DateTime as `timestamptz` will throw an exception"
- https://learn.microsoft.com/en-us/dotnet/api/system.dateonly.todatetime
  > "The Kind property of the resulting DateTime is initialized to DateTimeKind.Unspecified."

### V3-h-partial-unique-index (harm: index-filter)
- https://learn.microsoft.com/en-us/ef/core/modeling/indexes
  > "Some relational databases allow you to specify a filtered or partial index."
  > "You can use the Fluent API to specify a filter on an index, provided as a SQL expression"
- https://www.postgresql.org/docs/16/indexes-partial.html (официальная документация PostgreSQL)
  > "The idea here is to create a unique index over a subset of a table, as in Example 11.3. This enforces uniqueness among the rows that satisfy the index predicate, without constraining those that do not."
- https://www.postgresql.org/docs/16/indexes-unique.html
  > "By default, null values in a unique column are not considered equal, allowing multiple nulls in the column. The `NULLS NOT DISTINCT` option modifies this and causes the index to treat nulls as equal."

  `RegistrationStatus` хранится как `int` (конвертера нет), `Cancelled = 2`. Имена столбцов EF
  создаёт в кавычках, поэтому фильтр `"Status" <> 2` корректен. Несколько регистраций групповых
  заказов с `UserId = null` индекс не нарушают.

### V3-h-unique-violation-catch (harm: unique-constraint-handling)
- https://learn.microsoft.com/en-us/ef/core/modeling/indexes
  > "Attempting to insert more than one entity with the same values for the index's column set will cause an exception to be thrown."
- https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete
  > "the database throws an exception, which is then wrapped in a `DbUpdateException` by SaveChanges."
- https://www.npgsql.org/doc/api/Npgsql.PostgresException.html
  > "The exception that is thrown when the PostgreSQL backend reports errors (e.g. query SQL issues, constraint violations)."
  > SqlState: "The SQLSTATE code for the error." (константы - в `PostgresErrorCodes`)

## V4

### V4-temp-key-fk (unit: generated-keys)
- https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-3.x/breaking-changes#temporary-key-values-are-no-longer-set-onto-entity-instances
  > "Starting with 3.0, EF Core stores the temporary key value as part of the entity's tracking information, and leaves the key property itself unchanged."
  > Mitigations: "Setting navigation properties to form relationships instead of setting foreign key values."

  В кейсе `PriceChange.PriceListEntryId = entry.Id` присваивается до SaveChanges, навигации нет,
  а FK `PriceChange → PriceListEntry` настроен в `CoopDbContext`.

### V4-h-decimal-numeric (harm: provider-type-mapping)
- https://www.npgsql.org/doc/types/basic.html
  > Чтение: "numeric | decimal | …"; запись: "numeric | decimal, BigInteger (6.0+) | Numeric | Decimal, VarNumeric"
- https://www.postgresql.org/docs/16/datatype-numeric.html (официальная документация PostgreSQL)
  > "Specifying: NUMERIC without any precision or scale creates an "unconstrained numeric" column in which numeric values of any length can be stored, up to the implementation limits. A column of this kind will not coerce input values to any particular scale"

### V4-h-executeupdate-in-transaction (harm: bulk-update)
- https://learn.microsoft.com/en-us/ef/core/saving/execute-insert-update-delete
  > "they take effect immediately, at the point in which they are invoked."
  > "To wrap multiple operations in a single transaction, explicitly start a transaction with DatabaseFacade"
