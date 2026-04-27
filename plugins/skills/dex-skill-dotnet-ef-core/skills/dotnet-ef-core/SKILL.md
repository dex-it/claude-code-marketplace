---
name: dotnet-ef-core
description: EF Core — ловушки запросов, миграций, concurrency, mapping. Активируется при ef core, dbcontext, migration, N+1, AsNoTracking, Include, AsSplitQuery, IQueryable, ExecuteUpdate, OwnsOne, OwnsMany, owned type, value object
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

### Фильтр в памяти после материализации
Плохо: `(await repo.GetAllAsync()).Where(x => x.IsActive)` — бизнес-фильтр применяется после `ToList`
Правильно: фильтр внутри `IQueryable` до материализации: `repo.Query().Where(x => x.IsActive).ToListAsync()`
Почему: БД тянет все строки по сети, фильтрация в памяти процесса. На больших таблицах — OOM или тайм-аут. Бизнес-условие (`flag != 0`, `status == active`) после `ToList` — red flag, переносить в `Where`

### GroupBy / агрегации в памяти
Плохо: `(await repo.GetAllAsync()).GroupBy(x => x.Category).ToDictionary(...)` или `.Count()` / `.Sum()` после `ToList`
Правильно: `.GroupBy(x => x.Category).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(...)` — транслируется в SQL `GROUP BY`
Почему: EF Core транслирует большинство группировок и агрегаций в SQL. Материализация до группировки тянет все строки и ломает план запроса. Агрегации (`Count`, `Sum`, `Any`) должны идти SQL-запросом, не коллекцией в памяти

### Репозиторий материализует вместо IQueryable
Плохо: `Task<List<T>> FilterAsync(spec)` — метод возвращает `List`, дальнейшая композиция невозможна
Правильно: `IQueryable<T> Query(spec)` для композиции на уровне сервиса / handler (или specialized read-методы типа `GetByIdAsync`, `GetPagedAsync` с проекцией внутри)
Почему: возврат `List` из репозитория = любой caller тянет всю сущность со всеми навигациями, теряется возможность добавить `Where`/`Select`/`Take` на сервере. Красивая абстракция «репозиторий скрывает EF» ценой N×объёма трафика и Change Tracker-раздувания

> Общие LINQ ловушки (Count vs Any, фильтрация, коллекции) — см. `dex-skill-linq-optimization`

## Add vs AddAsync

Плохо: `await context.Products.AddAsync(product)` — без необходимости
Правильно: `context.Products.Add(product)` + `await SaveChangesAsync()`
Почему: `AddAsync` делает дополнительный запрос к БД для получения ID (HiLo sequence). Нужен ТОЛЬКО при `UseHiLo()`. Для Guid/client-generated id — `Add()` достаточно

## Mapping

### Owned-Type из одного значимого поля
Плохо: `OwnsOne(x => x.Complexity)` где `Complexity` — Value Object из 1 свойства; либо Owned-Type, в котором после ревью / чистки осталось одно поле (остальные удалены как избыточные)
Правильно: схлопни в плоское свойство на родителе с осмысленным именем (`x.ComplexityScore`). Owned-Type оправдан от 2+ полей, объединённых инвариантом, или когда планируется отдельная таблица (`OwnsOne` + `ToTable`)
Почему: Owned-Type из 1 поля = overhead конфигурации (`OnModelCreating`, миграция с префиксом `Complexity_`, `OwnsOne(...).Property(...)`) без выгоды. Value Object из одного значения не несёт инварианта (нечего связывать), это псевдо-абстракция. Сигнал к схлопыванию: после удаления избыточных полей в Owned-Type осталось одно — это уже не Value Object, это поле под чужим именем

> Связанные ловушки: что вообще хранить в Aggregate / Owned-Type — см. `dex-skill-ddd` («Persisted-поле без потребителя»).

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

## Чек-лист

- AsNoTracking для read-only, Select проекция для списков
- Нет N+1 (Include или Select, не ленивая загрузка)
- Фильтры и GroupBy / агрегации на сервере, не в памяти после ToList
- Репозитории возвращают IQueryable для композиции или проекционные read-методы, не List с полной сущностью
- Add() вместо AddAsync() (если не HiLo)
- ConcurrencyToken на сущности с concurrent access
- AsSplitQuery для множественных Include (но не для single entity)
- Bulk: ExecuteUpdate/Delete вместо цикла SaveChanges
- Миграции: idempotent script для production, данные отдельно от схемы
- DbContext: Scoped, в BackgroundService через IServiceScopeFactory
