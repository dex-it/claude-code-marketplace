---
name: ef-core
description: Entity Framework Core — ловушки запросов, транзакций, concurrency, миграций. Активируется при ef core, DbContext, BeginTransaction, TransactionScope, savepoint, IsolationLevel, DTC, UseTransaction, ExecutionStrategy, ConcurrencyToken, AsNoTracking, Include, AsSplitQuery, ExecuteUpdate, N+1, AddAsync, FromSqlRaw, FromSqlInterpolated, CompileAsyncQuery, SaveChanges
---

# Entity Framework Core — ловушки и anti-patterns

## Запросы

### N+1 — ленивая загрузка
Плохо: `orders[0].Customer.Name` — каждое обращение к навигации = скрытый SQL запрос
Правильно: `Include(o => o.Customer)` или `.Select(o => new { o.Id, o.Customer.Name })`
Почему: 100 заказов = 1 + 100 запросов вместо одного. Проблема тихая — нет ошибки, только медленно

### AsNoTracking забыт для read-only
Плохо: `context.Products.Where(p => p.IsActive).ToListAsync()` — все entities в Change Tracker
Правильно: `.AsNoTracking()` для данных, которые не будут изменяться
Почему: Change Tracker хранит копию каждой entity в памяти + сравнивает при DetectChanges. На 10000 записей — ощутимый overhead

### ToList() вместо проекции
Плохо: `context.Orders.Include(o => o.Items).ToListAsync()` — для списка нужны только Id и Total
Правильно: `.Select(o => new OrderDto(o.Id, o.Total, o.Items.Count)).ToListAsync()`
Почему: грузишь 20 полей × 1000 строк вместо 3 полей × 1000 строк. SQL тяжелее, трафик больше, Change Tracker раздувается

> Общие LINQ ловушки (Count vs Any, фильтрация, коллекции) — см. `dex-skill-linq-optimization`

## Add vs AddAsync

Плохо: `await context.Products.AddAsync(product)` — без необходимости
Правильно: `context.Products.Add(product)` + `await SaveChangesAsync()`
Почему: `AddAsync` делает дополнительный запрос к БД для получения ID (HiLo sequence). Нужен ТОЛЬКО при `UseHiLo()`. Для Guid/client-generated id — `Add()` достаточно

## Cascade Delete

### Soft-delete + cascade = потеря данных
Плохо: soft-delete родителя (`IsDeleted = true`), а БД каскадно УДАЛЯЕТ дочерние записи физически
Правильно: `OnDelete(DeleteBehavior.Restrict)` или `ClientCascade` при soft-delete
Почему: EF soft-delete = update. Но FK constraint в БД настроен на CASCADE DELETE. При ручном SQL `DELETE FROM parents` — дочерние записи удалены навсегда

### Orphans при required FK
Плохо: `blog.Posts.Clear(); SaveChanges()` — ожидаешь что посты станут "без блога"
Правильно: понимай что required FK (non-nullable) → EF УДАЛИТ orphaned записи
Почему: `PostId int` (required) не может быть null. EF единственный вариант — удалить запись. Если нужно "открепить" — используй nullable FK

## Concurrency

### Нет ConcurrencyToken — last write wins
Плохо: два пользователя загрузили Order → оба меняют → второй тихо перезаписывает первого
Правильно: `[Timestamp] public byte[] RowVersion` (SQL Server) или `UseXminAsConcurrencyToken()` (PostgreSQL)
Почему: без concurrency token EF не проверяет что запись изменилась между read и write. Данные первого пользователя потеряны без ошибки

### Пессимистичная блокировка без транзакции
Плохо: `SELECT ... FOR UPDATE` без `BeginTransactionAsync()` — блокировка не работает
Правильно: `await using var tx = await context.Database.BeginTransactionAsync()` → `FOR UPDATE` → work → `CommitAsync`
Почему: `FOR UPDATE` без транзакции освобождается сразу после SELECT. Другой поток прочитает и изменит данные до вашего SaveChanges

## Bulk Operations

### Цикл SaveChanges вместо ExecuteUpdate
Плохо: `foreach (var p in products) { p.Price *= 1.1m; } SaveChanges()` — загрузка всех entities в память
Правильно: `ExecuteUpdateAsync(s => s.SetProperty(p => p.Price, p => p.Price * 1.1m))` (EF 7+)
Почему: цикл загружает 10000 entities в Change Tracker, потом генерирует 10000 UPDATE. ExecuteUpdate = один SQL запрос

### Массовое удаление одной транзакцией
Плохо: `context.AuditLogs.Where(old).ExecuteDeleteAsync()` — 1M строк одной транзакцией
Правильно: батчи по 1000: `.Take(1000).ExecuteDeleteAsync()` в цикле с `Task.Delay` между батчами
Почему: одна транзакция на миллион строк блокирует таблицу, раздувает WAL/transaction log, тормозит весь сервер

## Split Queries

### Cartesian explosion
Плохо: `Orders.Include(o => o.Items).Include(o => o.Payments).ToListAsync()` — один запрос с двумя JOIN
Правильно: `.AsSplitQuery()` — отдельный запрос для каждого Include
Почему: два Include = cartesian product. 10 orders × 5 items × 3 payments = 150 строк вместо 10+50+30. На больших данных — из мегабайта делает гигабайт

### AsSplitQuery для single entity
Плохо: `Orders.Where(o => o.Id == id).Include(o => o.Items).AsSplitQuery().SingleAsync()`
Правильно: без AsSplitQuery — для одной entity JOIN эффективнее 2 запросов
Почему: AsSplitQuery = дополнительный roundtrip к БД. Для single entity overhead roundtrip > overhead маленького cartesian

## Миграции

### dotnet ef database update на production
Плохо: `dotnet ef database update` в CI/CD pipeline для production
Правильно: `dotnet ef migrations script --idempotent` → ревью SQL → применение через DBA/migration tool
Почему: EF генерирует SQL, который может содержать блокирующие ALTER TABLE, потерю данных. Без ревью — production down

### Данные и схема в одной миграции
Плохо: `ALTER TABLE` + `UPDATE SET` + `INSERT INTO` в одной миграции
Правильно: отдельная миграция для схемы, отдельная для данных
Почему: схемная миграция блокирует таблицу. Если data migration внутри неё — блокировка затягивается. При откате — неопределённое состояние

## DbContext lifetime

### DbContext как Singleton
Плохо: `services.AddSingleton<AppDbContext>()` или DbContext в статическом поле
Правильно: `AddDbContext<AppDbContext>()` (Scoped по умолчанию)
Почему: Change Tracker растёт бесконечно (memory leak), stale данные, DbContext не thread-safe — concurrent access = random exceptions

### DbContext в BackgroundService
Плохо: инжектить `AppDbContext` в `BackgroundService` — Scoped в Singleton
Правильно: `IServiceScopeFactory` → `CreateScope()` → resolve `AppDbContext` внутри scope
Почему: Scoped service captured by Singleton = один DbContext на весь lifetime приложения. Change Tracker, stale data, ObjectDisposedException

## Транзакции

### ExecutionStrategy + verifySucceeded
Плохо: `optionsBuilder.EnableRetryOnFailure()` без verifySucceeded — при "lost ACK" операция дублируется
Правильно: `ExecutionStrategy.ExecuteInTransactionAsync(operation, verifySucceeded)` с проверкой что данные записались
Почему: retry после timeout не знает — запрос выполнился или нет. Без проверки — дублирование записей

### Вложенный BeginTransaction — InvalidOperationException
Плохо: `BeginTransactionAsync()` при активной `CurrentTransaction` — бросит `InvalidOperationException`, вложенные TX на уровне EF невозможны
Правильно: savepoint внутри активной TX — `tx.CreateSavepointAsync(name)` / `RollbackToSavepointAsync(name)` для частичного отката
Почему: EF проверяет `CurrentTransaction != null` через `EnsureNoTransactions()` guard. Savepoints — единственный механизм частичного отката. `SaveChanges` внутри TX автоматически создаёт `__EFSavePoint` при `AutoSavepointsEnabled`

### Вложенная TX — недостаточная изоляция внешней
Плохо: метод требует `Serializable`, но вызван изнутри handler'а, который уже открыл TX в `ReadCommitted` — метод молча работает в слабом уровне, инвариант сломан
Правильно: на входе guard — `context.Database.CurrentTransaction?.GetDbTransaction().IsolationLevel` против требуемого, падай с `InvalidOperationException` если слабее
Почему: сменить isolation level внутри активной TX нельзя (`BeginTransaction(level)` бросит `InvalidOperationException` через тот же guard). Молчаливое выполнение в чужом слабом уровне = lost update / phantom read под нагрузкой. Компоненты переиспользуемы, метод не знает заранее standalone его вызвали или из уже открытой TX

### Multi-context в одной операции
Плохо: `OrderDbContext` + `IdentityDbContext` в одном handler, оба открывают свои TX и делают SaveChanges — две независимые транзакции, атомарности нет
Правильно: одна БД, два EF контекста — shared `DbConnection` + `ctx2.Database.UseTransactionAsync(tx.GetDbTransaction())`. Для EF + Dapper/ADO.NET к той же БД — `TransactionScope` с `TransactionScopeAsyncFlowOption.Enabled` (обязательно, иначе ambient TX теряется на await)
Почему: одно соединение = одна TX без DTC. `TransactionScope` эскалируется в distributed TX через MSDTC при двух одновременных соединениях — на Linux `PlatformNotSupportedException`, Npgsql distributed TX не поддерживает с v6. Разные БД или микросервисы — только Outbox pattern

### ChangeTracker + чужие unsaved entities
Плохо: перед `BeginTransactionAsync()` в Change Tracker уже есть Modified entities от предыдущей логики
Правильно: `context.ChangeTracker.Clear()` перед транзакцией или Scoped DbContext per operation
Почему: `SaveChangesAsync()` внутри TX сохранит ВСЕ tracked entities — и ваши, и чужие. Атомарность нарушена

## Raw SQL

### FromSqlRaw + string interpolation = SQL injection
Плохо: `FromSqlRaw($"SELECT * FROM Users WHERE Name = '{name}'")` — выглядит безопасно из-за `$`, но параметр вставляется как текст
Правильно: `FromSqlInterpolated($"SELECT * FROM Users WHERE Name = {name}")` — EF параметризует автоматически
Почему: `FromSqlRaw` принимает строку как есть. `$` — это C# interpolation, не SQL параметр. Классическая injection через `'; DROP TABLE Users;--`

## Compiled Queries

### Hot path без CompileAsyncQuery
Плохо: `db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id)` — вызывается 1000 раз/сек, каждый раз компилируется expression tree → SQL
Правильно: `private static readonly Func<AppDbContext, int, Task<Order?>> GetOrder = EF.CompileAsyncQuery((AppDbContext db, int id) => db.Orders.Include(o => o.Items).FirstOrDefault(o => o.Id == id));`
Почему: компиляция LINQ → SQL стоит ~1-2ms. На hot path (API endpoint с высоким RPS) это 10-20% latency. Compiled query компилируется один раз

## Чек-лист

- AsNoTracking для read-only, Select проекция для списков
- Нет N+1 (Include или Select, не ленивая загрузка)
- Add() вместо AddAsync() (если не HiLo)
- ConcurrencyToken на сущности с concurrent access
- AsSplitQuery для множественных Include (но не для single entity)
- Bulk: ExecuteUpdate/Delete вместо цикла SaveChanges
- Миграции: idempotent script для production, данные отдельно от схемы
- DbContext: Scoped, в BackgroundService через IServiceScopeFactory
- ExecutionStrategy с verifySucceeded для retry-сценариев
- Нет вложенных TX: используй savepoints (CreateSavepointAsync), проверяй достаточность isolation level внешней TX
- Multi-context в одной БД: shared DbConnection + UseTransactionAsync; Outbox — только для cross-service
- ChangeTracker.Clear() перед транзакцией если контекст переиспользуется
- FromSqlInterpolated вместо FromSqlRaw с интерполяцией (SQL injection)
- CompileAsyncQuery для hot path запросов (высокий RPS)
