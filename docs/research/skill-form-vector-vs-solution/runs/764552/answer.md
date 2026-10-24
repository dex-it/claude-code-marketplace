Созданные/изменённые файлы:
- `OrderQueries.cs` (создан) — новый сервис `OrderQueries`: `GetOrderCardAsync`, `GetCustomerOrdersAsync`, `GetProductBySku`, `GetLastShippedDateAsync`.
- `_answer.md` (создан) — тот же ответ.

Решения (кратко):
- Карточка заказа и выгрузка заказов клиента используют `AsSplitQuery()`+`AsNoTracking()` (иначе Items×Payments дают декартово произведение); выгрузка по клиенту отдаётся как `IAsyncEnumerable<Order>` потоково, т.к. заказов могут быть тысячи.
- `GetProductBySku`: `warehouse` — nullable; если передан, ищем уникальную пару (sku, warehouse); если не передан и SKU есть на нескольких складах — бросаем `InvalidOperationException`, а не угадываем склад.
- `GetLastShippedDateAsync` возвращает не-nullable `DateTime`, а если отгруженных заказов нет — явно бросает исключение вместо подмены на `DateTime.MinValue`.