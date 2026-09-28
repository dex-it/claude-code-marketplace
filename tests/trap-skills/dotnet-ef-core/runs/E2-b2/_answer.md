Создан файл:
- /Users/anonymous/.cache/review/pr280/runs/E2-N2/OrderQueries.cs — новый сервис `OrderQueries` (namespace `Shop.Data`) с методами:
  - `GetOrderCardAsync(Guid orderId, ct)` — заказ + Items + Payments;
  - `GetCustomerOrdersAsync(Guid customerId)` — все заказы клиента с Items/Payments;
  - `GetProductBySku(string sku, string? warehouse, ct)` — продукт по SKU (+опционально склад);
  - `GetLastShippedDateAsync(Guid customerId, ct)` — дата отгрузки последнего отгруженного заказа.

Изменённых файлов нет.

Ключевые решения:
- Для (а)/(б) везде `AsNoTracking()` + `AsSplitQuery()`, т.к. у заказа две параллельные коллекции (Items, Payments) — без split query они перемножились бы в один JOIN (декартово произведение), что при тысячах заказов/позиций дало бы взрывной рост строк.
- (б) возвращает `IAsyncEnumerable<Order>` (потоковая выгрузка через `await foreach`), а не `List<Order>` — при тысячах заказов клиента материализация всего сразу в память нежелательна; сортировка по `CreatedAt` для детерминированного порядка выгрузки.
- (в) при переданном `warehouse` — точечный поиск по уникальной паре (sku, warehouse); при `warehouse == null` и единственном совпадении — возврат его; при нескольких совпадениях (SKU на разных складах) — явный `InvalidOperationException` с перечислением складов, а не «случайный» выбор одного из них, т.к. цена/остаток по складам различаются.
- (г) возвращает не-nullable `DateTime`; если у клиента нет ни одного отгруженного заказа — `InvalidOperationException` вместо «магической» даты по умолчанию (DateTime.MinValue легко перепутать с реальной датой).
