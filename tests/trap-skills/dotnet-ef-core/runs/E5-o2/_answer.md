Изменённые/созданные файлы:
- Изменён: /Users/anonymous/.cache/review/pr280/runs/E5-O2/Model.cs — `UseXminAsConcurrencyToken()` для `Order`.
- Изменён: /Users/anonymous/.cache/review/pr280/runs/E5-O2/OrderRepository.cs — `UpdateOrderAsync(order, expectedVersion)`, `GetVersion(order)`, `OrderConcurrencyConflictException`.
- Создан: /Users/anonymous/.cache/review/pr280/runs/E5-O2/ProductRepository.cs — `ReserveAsync(productId, qty)`, `SearchAsync(category, minPrice)`, `InsufficientStockException`.

Решения:
- (а) Order: concurrency token — системная колонка `xmin` (без миграции схемы/данных), а не last-write-wins. Заказ приходит из админки как detached-сущность: `Attach` + `Property("xmin").OriginalValue = expectedVersion` + `SaveChangesAsync`; при расхождении версии EF бросает `DbUpdateConcurrencyException`, которую оборачиваем в `OrderConcurrencyConflictException` — админка должна перечитать заказ и повторить правку, а не молча переписать чужие изменения.
- (б) Reserve: `SELECT * FROM "Products" WHERE "Id" = {0} FOR UPDATE` через `FromSqlRaw` строго внутри `BeginTransactionAsync`/`CommitAsync` (без транзакции блокировка снимается сразу после SELECT). Конкурирующий Reserve того же товара ждёт коммита первой транзакции и видит уже уменьшенный остаток — уйти в минус нельзя; при нехватке остатка бросаем исключение до записи.
- (в) SearchAsync: шаблон `"SELECT * FROM \"Products\" p WHERE {0}"` с зафиксированной константой алиаса `p`, которая используется и в шаблоне, и во всех динамически собираемых условиях (иначе рантайм-ошибка «missing FROM-clause entry»). Значения category/minPrice никогда не подставляются в текст SQL — только как параметры `FromSqlRaw` (`{0}`, `{1}`, ...), что закрывает SQL injection. Запрос read-only → `AsNoTracking()`.
