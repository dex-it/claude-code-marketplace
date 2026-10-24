Создан файл: `OrderQueries.cs` (класс `OrderQueries` в namespace `Shop.Data`), ответ также записан в `_answer.md`.

Решения:
- Везде `AsNoTracking()` (чтение) и `AsSplitQuery()` там, где в одном запросе две коллекции (Items + Payments), чтобы не получить декартово произведение — особенно важно для клиента с тысячами заказов.
- `GetProductBySkuAsync`: SKU уникален только в рамках склада, а склад может быть `null`, поэтому вместо `Single`/`SingleOrDefault` (упадёт при нескольких складах) — `Where(sku && (warehouse==null || match))` + детерминированный `OrderBy(Warehouse).FirstOrDefault()`.
- `GetLastShippedAtAsync`: `MaxAsync` считается в БД по отфильтрованным `ShippedAt != null` заказам, без `!`; поскольку возврат не-nullable `DateTime`, отсутствие отгруженных заказов явно превращается в `InvalidOperationException`.