Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs/E5-W2/Model.cs — изменён (b.Entity<Order>().UseXminAsConcurrencyToken() в OnModelCreating)
- /Users/anonymous/.cache/review/pr280/runs/E5-W2/OrderRepository.cs — изменён (GetForEditAsync/UpdateOrderAsync, OrderConcurrencyConflictException, AsNoTracking на чтении)
- /Users/anonymous/.cache/review/pr280/runs/E5-W2/ProductRepository.cs — создан (ReserveAsync, SearchAsync)

Решения:
- (а) Конкурентность заказа: системная колонка Postgres `xmin` как токен через `UseXminAsConcurrencyToken()` — без миграции. `UpdateOrderAsync` присоединяет отсоединённую сущность, задаёт `OriginalValue` для xmin из ранее прочитанного `GetForEditAsync`, и при коллизии (0 строк обновлено) превращает `DbUpdateConcurrencyException` в `OrderConcurrencyConflictException` для оператора.
- (б) `Reserve`/`ReserveAsync`: `SELECT ... FOR UPDATE` через `FromSqlRaw` внутри явной транзакции (`BeginTransactionAsync`), без дальнейшей LINQ-композиции поверх raw SQL (взяли список и `SingleOrDefault` в памяти, а не `.Where`/`.SingleOrDefaultAsync`, чтобы EF не оборачивал FOR UPDATE в подзапрос); списание Stock и коммит — в той же транзакции, поэтому конкурентные резервы одного товара сериализуются блокировкой строки.
- (в) `SearchAsync`: шаблон `"SELECT * FROM \"Products\" p WHERE {0}"`, условия (категория/цена) собираются как текст с плейсхолдерами `{n}` под уже фиксированные операторы, а сами значения всегда передаются как параметры `FromSqlRaw` (никогда не интерполируются как литералы) — SQL-инъекция исключена; выборка read-only → `AsNoTracking()`.
