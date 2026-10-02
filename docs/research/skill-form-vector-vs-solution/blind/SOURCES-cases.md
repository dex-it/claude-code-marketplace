# SOURCES: сверка ключей с документацией

Документацию сверял 2026-10-02 через WebFetch. Цитаты даны дословно (на английском, как в источнике).
Стек кейсов: EF Core 8.0.x, Npgsql.EntityFrameworkCore.PostgreSQL 8.0.x, PostgreSQL 16; там, где
поведение зависит от версии, это отмечено.

Строки `coverage` (дефекты вне EF Core: BR-billing, BR-discharge-auth, BN-pagination, BN-dose-grams)
проверяются по README/MR.md кейса и не опираются на документацию EF/Npgsql.

## Источники (коротко)

| Код | URL |
| --- | --- |
| CE | https://learn.microsoft.com/en-us/ef/core/querying/client-eval |
| TR | https://learn.microsoft.com/en-us/ef/core/querying/tracking |
| SOD | https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.singleordefaultasync |
| SQL | https://learn.microsoft.com/en-us/ef/core/querying/sql-queries |
| FSR | https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.relationalqueryableextensions.fromsqlraw |
| NDT | https://www.npgsql.org/doc/types/datetime.html |
| N6 | https://www.npgsql.org/efcore/release-notes/6.0.html |
| NTR | https://www.npgsql.org/efcore/mapping/translations.html |
| QF | https://learn.microsoft.com/en-us/ef/core/querying/filters |
| CD | https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete |
| SPL | https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries |
| EF10 | https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew |
| MA | https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying |
| MM | https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing |

---

## untranslatable-filter

### B1-senior-filter, B1-phone-translate, BR-long-stays (unit)

CE: https://learn.microsoft.com/en-us/ef/core/querying/client-eval

> "If EF Core detects an expression, in any place other than the top-level projection, which can't be
> translated to the server, then it throws a runtime exception."

> "Because the filter can't be applied in the database, all the data needs to be pulled into memory to
> apply the filter on the client. Based on the filter and the amount of data on the server, client
> evaluation could result in poor performance. So Entity Framework Core blocks such client evaluation
> and throws a runtime exception."

Ветка fail «загрузить в память и отфильтровать» - явная клиентская оценка; документация допускает её, когда:

> "The amount of data is small so that evaluating on the client doesn't incur a huge performance penalty."

В B1 объём задан в поручении (250 тыс. питомцев), в BR - вся история госпитализаций, поэтому это fail.
`Pet.IsSenior`/`AgeYears`, `Stay.DaysInWard` - get-only свойства без сеттера, EF их не маппит
(по конвенции маппятся свойства с геттером и сеттером), значит в Where они нетранслируемы.

### BN-h-tolower (harm)

NTR: https://www.npgsql.org/efcore/mapping/translations.html - строки таблицы трансляций:

> `stringValue.ToLower()` → `lower(stringValue)`
> `stringValue.Contains(value)` → `stringValue LIKE %value%`

То есть `p.Title.ToLower().Contains(q)` выполняется на сервере; утверждение о клиентской оценке ложно.

---

## readonly-tracking

### B1-report-notracking, B3-export-notracking (unit); BN-h-tracking (harm); B1-m-notracking-write (mine)

TR: https://learn.microsoft.com/en-us/ef/core/querying/tracking

> "No-tracking queries are useful when the results are used in a read-only scenario. They're generally
> quicker to execute because there's no need to set up the change tracking information. If the entities
> retrieved from the database don't need to be updated, then a no-tracking query should be used."

> "If the result set doesn't contain any entity types, then no tracking is done."
(основание для pass через проекцию в DTO и для BN-h-tracking: проекции в BN не отслеживаются)

> "By default, queries that return entity types are tracking. A tracking query means any changes to
> entity instances are persisted by `SaveChanges`."

> "If an entity is tracked, any changes detected in the entity are persisted to the database during
> `SaveChanges`."
(основание для B1-m-notracking-write и второй части BN-h-tracking: без отслеживания изменения
не сохраняются)

> "The default tracking behavior can be changed at the context instance level:
> `context.ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;`"

---

## single-not-unique

### B1-phone-multi, BR-box-occupant (unit); B1-h-email-single, BR-h-box-code, BN-h-chip-single (harm)

SOD: https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.entityframeworkqueryableextensions.singleordefaultasync

> "Asynchronously returns the only element of a sequence that satisfies a specified condition or a
> default value if no such element exists; this method throws an exception if more than one element
> satisfies the condition."

> Exceptions: "InvalidOperationException - More than one element satisfies the condition in `predicate`."

Неуникальность условий задана в проекте: B1 - комментарий к `Owner.Phone` и неуникальный индекс;
BR - `Box.Capacity` и README. Уникальность для приманок задана уникальными индексами:
`Owner.Email` (B1), `Box.Code` (BR), `Pet.ChipNumber` (BN) - `HasIndex(...).IsUnique()`.

---

## fromsql-alias

### B3-scope-sql, BR-occupancy-sql (unit)

SQL: https://learn.microsoft.com/en-us/ef/core/querying/sql-queries (раздел "Dynamic SQL and parameters")

> "This code doesn't work, since databases do not allow parameterizing column names (or any other part
> of the schema)."

> "Accepting a column name from a user may allow them to choose a column that isn't indexed, making the
> query run extremely slowly and overload your database; or it may allow them to choose a column
> containing data you don't want exposed. Except for truly dynamic scenarios, it's usually better to
> have two queries for two column names, rather than using parameterization to collapse them into a
> single query."

> "In the above code, the column name is inserted directly into the SQL, using C# string interpolation.
> It is your responsibility to make sure this string value is safe, sanitizing it if it comes from an
> unsafe origin [...] On the other hand, the column value is sent via a `DbParameter`, and is therefore
> safe in the face of SQL injection."

> "The FromSql and FromSqlInterpolated methods are safe against SQL injection, and always integrate
> parameter data as a separate SQL parameter. However, the FromSqlRaw method can be vulnerable to SQL
> injection attacks, if improperly used."

FSR: https://learn.microsoft.com/en-us/dotnet/api/microsoft.entityframeworkcore.relationalqueryableextensions.fromsqlraw

> "You can include parameter place holders in the SQL query string and then supply parameter values as
> additional arguments. Any parameter values you supply will automatically be converted to a DbParameter."

> "However, **never** pass a concatenated or interpolated string (`$""`) with non-validated
> user-provided values into this method."

### B3-drug-resultset (unit)

SQL, раздел "Limitations":

> "The SQL query must return data for all properties of the entity type."
> "The column names in the result set must match the column names that properties are mapped to."

SQL, раздел "Composing with LINQ":

> "You can compose on top of the initial SQL query using LINQ operators; EF Core will treat your SQL as
> a subquery and compose over it in the database."

(SELECT * по JOIN двух таблиц даёт дублирующиеся имена колонок в подзапросе, по которому EF строит
внешний SELECT; дублирование визитов при JOIN - свойство SQL, не EF.)

### B3-h-existing-search, BR-h-history-fromsql, BN-h-fromsql (harm)

- `{0}` в FromSqlRaw с отдельным аргументом (B3 SearchAsync) - FSR: "Any parameter values you supply
  will automatically be converted to a DbParameter."
- FromSql с интерполяцией (BR GetPetHistoryAsync, BN SearchNotesAsync) - SQL: "While this syntax may
  look like regular C# string interpolation, the supplied value is wrapped in a `DbParameter` and the
  generated parameter name inserted where the `{0}` placeholder was specified. This makes FromSql safe
  from SQL injection attacks".
- BN GetConsumptionAsync (SqlQueryRaw, ORDER BY из словаря, значения - NpgsqlParameter): SQL -
  "SqlQueryRaw allows for dynamic construction of SQL queries, just like FromSqlRaw does for entity
  types."; "The type used must have a property for every value in the result set" (алиасы
  `"Item"`, `"Unit"`, `"Total"` совпадают со свойствами `ConsumptionRow`); FSR - "In addition to using
  positional placeholders as above (`{0}`), you can also use named placeholders directly in the SQL
  query string" (именованные `@from`/`@to`/`@closed` с DbParameter).

---

## datetime-column

### B1-optout-utc, B2-deletedat-utc, B3-export-range-utc (unit)

N6: https://www.npgsql.org/efcore/release-notes/6.0.html

> "DateTime properties now map to `timestamptz` by default, instead of to `timestamp`"

> "It is no longer possible to write DateTime with Kinds Local or Unspecified to `timestamptz`
> properties (which are the default for DateTime)."

NDT: https://www.npgsql.org/doc/types/datetime.html

> "Starting with 6.0, Npgsql maps UTC DateTime to `timestamp with time zone`, and Local/Unspecified
> DateTime to `timestamp without time zone`; trying to send a non-UTC DateTime as `timestamptz` will
> throw an exception, etc."

В B1/B2/B3 тип колонки не задан явно, значит `timestamptz` (по умолчанию). B3-export-range-utc помечен
`disputed`: для записи (SaveChanges) исключение описано прямо, для параметров запроса - общей фразой
"send a non-UTC DateTime as timestamptz will throw"; вторая ветка fail (сдвиг на 5 ч при
SpecifyKind(Utc) без перевода пояса) следует из README кейса, а не из Npgsql.

### B1-h-legacy-switch (harm)

NDT:

> "to revert to the pre-6.0 behavior, add the following at the start of your application, before any
> Npgsql operations are invoked: `AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);`"

N6:

> "UTC timestamps have been cleanly separated from non-UTC timestamps, aligning with the PostgreSQL
> types. The former are represented by `timestamp with time zone` and DateTime with Kind UTC, the
> latter by `timestamp without time zone` and DateTime with Kind Local or Unspecified."

(Переключатель меняет поведение дат для всего приложения - это вред при задаче «записать один момент».)

### BN-h-local-time (harm)

N6:

> "it is no longer possible to write DateTime with Kind UTC to a `timestamp` column"

NDT: "Local/Unspecified DateTime to `timestamp without time zone`" - запись Unspecified в колонку
`timestamp without time zone` (`HasColumnType("timestamp without time zone")` в BN) корректна, а
предложение перевести значение в UTC сломало бы запись.

---

## softdelete-cascade

### B2-owner-softdelete, BR-decommission-filter (unit); B2-h-filters-weakened (harm)

QF: https://learn.microsoft.com/en-us/ef/core/querying/filters

> "Note that at this point, you must manually set `IsDeleted` in order to soft-delete an entity."

> "Caution: Using required navigation to access entity which has global query filter defined may lead
> to unexpected results."

> "Required navigations in EF imply that the related entity is always present. Since inner joins may be
> used to fetch related entities, if a required related entity is filtered out by the query filter, the
> parent entity may get filtered out as well. This can result in unexpectedly retrieving fewer elements
> than expected."

> "This problem can be addressed by configuring the navigation as optional navigation instead of
> required, causing EF to generate a `LEFT JOIN` instead of an `INNER JOIN`"
> "An alternative approach is to specify consistent filters on both `Blog` and `Post` entity types"

> "Filters may be disabled for individual LINQ queries by using the IgnoreQueryFilters operator"

CD: https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete

> "Required relationships are configured to use cascade deletes by default."

> "If we know that the database is configured like this, then we can delete a blog *without first
> loading posts* and the database will take care of deleting all the posts that were related to that
> blog."

> "Warning: Do not configure cascade delete in the database when soft-deleting entities. This may cause
> entities to be accidentally really deleted instead of soft-deleted."

(В B2 FK Pet->Owner, Allergy->Pet, Visit->Pet обязательные без OnDelete - значит Cascade и
ON DELETE CASCADE в БД: `Remove(owner)` физически удалит всю медкарту.)

---

## required-orphans

### B2-allergies-orphans, BR-medplan-clear (unit); BN-h-consumable-remove (harm); BR-m-cascade-fix (mine)

CD: https://learn.microsoft.com/en-us/ef/core/saving/cascade-delete (раздел "Severing a relationship")

> "The relationship can also be severed by removing each post from the `Blog.Posts` collection
> navigation: [...] `blog.Posts.Clear();` [...] In either case the result is the same: the blog is not
> deleted, but the posts that are no longer associated with any blog are deleted"

> "Deleting entities that are no longer associated with any principal/dependent is known as "deleting
> orphans"."

Таблица "Required relationship with dependents/children loaded":

> "| Cascade | Dependents deleted by EF Core | Dependents deleted by EF Core |"
> "| Restrict | `InvalidOperationException` | `InvalidOperationException` |"

> "Using anything other than cascade delete for required relationships will result in an exception
> when SaveChanges is called."

- B2: связь Allergy->Pet обязательная, Cascade по умолчанию - `Clear()` = DELETE аллергий (нарушение README).
- BR: MedicationOrder->Stay обязательная с `OnDelete(DeleteBehavior.Restrict)` - `Clear()` =
  InvalidOperationException; «исправление» через Cascade/ClientCascade (BR-m-cascade-fix) превращает
  это в физическое удаление (строка Cascade той же таблицы), что противоречит README.
- BN: ConsumableLine->Procedure обязательная, Cascade по умолчанию, коллекция загружена через Include -
  `Remove(line)` удаляет строку (строка Cascade), что и требуется по README.

---

## split-single

### B3-lastvisit-split, BR-latest-stay-split (unit); BN-h-split-card (harm)

SPL: https://learn.microsoft.com/en-us/ef/core/querying/single-split-queries

> "Warning: When using split queries with Skip/Take on EF versions prior to 10, pay special attention to
> making your query ordering fully unique; not doing so could cause incorrect data to be returned. For
> example, if results are ordered only by date, but there can be multiple results with the same date,
> then each one of the split queries could get different results from the database. Ordering by both
> date and ID (or any other unique property or combination of properties) makes the ordering fully
> unique and avoids this problem. Note that relational databases do not apply any ordering by default,
> even on the primary key."

> "You can also configure split queries as the default for your application's context: [...]
> `o => o.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)`"

EF10: https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/whatsnew (раздел "More
consistent ordering for split queries") - показывает, что до EF 10 подзапрос корня в следующих
SQL split-запроса повторяет ограничение строк (`TOP(@__p_0)`) с пользовательским порядком без Id:

> "Note that the first query (the one reading Blogs) is integrated as a subquery within the second (the
> one reading Posts). However, the ordering within the subquery omits the `Id` column, leading to
> possible incorrect data being returned."

Вывод для ключа: `FirstOrDefault` - то же ограничение строк (LIMIT 1), что и `Take(1)`, поэтому при
неуникальном `OrderByDescending(SlotStart)` / `OrderByDescending(AdmittedOn)` в EF 8 корень в разных
запросах split может оказаться разным. Прямой цитаты именно про `First` в документации нет - это
вывод из двух цитат выше. Пользовательский тай-брейкер по Id попадает в ORDER BY подзапроса и
устраняет проблему.

Для BN-h-split-card: корень выбирается по первичному ключу (`SingleOrDefaultAsync(x => x.Id == id)`),
результат уникален без всякого порядка; две коллекции одного уровня - ровно случай, ради которого
существует split:

> "since both `Posts` and `Contributors` are collection navigations of `Blog` - they're at the same
> level - relational databases return a *cross product* [...] This phenomenon - sometimes called
> *cartesian explosion*"

Оговорка, которую судье не надо засчитывать как вред: документация называет общий недостаток split -
"If the database is updated concurrently when executing your queries, resulting data may not be
consistent." Упоминание этого как общего компромисса допустимо; вред - требование убрать split или
утверждение о смешении данных разных процедур.

---

## prod-migration

### B2-migration-path, BR-startup-migrate (unit); BR-m-ddl-grant (mine)

MA: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying

> "Use a SQL script instead when the SQL must be reviewed, modified, archived, or handed to a DBA before
> it is applied."

> "Use a separate identity for deployment that has permission to change the schema. The identity used
> by the application at run time should normally have only the permissions the application needs to
> read and write data."

Раздел "Apply migrations at runtime":

> "A separate migration deployment step is still preferred when review, least-privilege credentials,
> coordinated rollout, or high availability is important."
> "For versions of EF prior to 9, if multiple instances of your application are running, both
> applications could attempt to apply the migration concurrently and fail (or worse, cause data
> corruption)."
> "The application must have elevated access to modify the database schema. It's generally good
> practice to limit the application's database permissions in production."
> "The SQL commands are applied directly by the program, without giving the developer a chance to
> inspect or modify them. This can be dangerous in a production environment."

> "Don't install the SDK or run `dotnet ef` in the application image, and don't make every application
> replica run migrations from its entrypoint."

> "The following generates idempotent migrations: `dotnet ef migrations script --idempotent`"

Процесс выкладки кейса задан в README и `.gitlab-ci.yml` (B2, BR): идемпотентный скрипт, ручной
запуск DBA, роль приложения только DML; в BR - 3 реплики, rolling update, EF 8 (без блокировки
миграций, она появилась в EF 9: "Starting with EF Core 9, MigrateAsync and Migrate automatically
acquire a database-wide lock").

### B2-m-drop-notes (mine)

MM: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/managing (раздел "Column renames")

> "if you rename a property from `Name` to `FullName`, EF Core will generate the following migration:
> `migrationBuilder.DropColumn(...)` `migrationBuilder.AddColumn<string>(...)`"

> "EF Core is generally unable to know when the intention is to drop a column and create a new one (two
> separate changes), and when a column should be renamed. If the above migration is applied as-is, all
> your customer names will be lost. To rename a column, replace the above generated migration with the
> following: `migrationBuilder.RenameColumn(...)`"

MA:

> "Note: Whatever your deployment strategy, always inspect the generated migrations and test them before
> applying to a production database. A migration may drop a column when the intent was to rename it"
