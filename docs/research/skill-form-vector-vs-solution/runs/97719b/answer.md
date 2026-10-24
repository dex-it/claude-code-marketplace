Создан файл `OrderQueries.cs` (класс `Shop.Data.OrderQueries`, ответ также записан в `_answer.md`).

Решения:
- (б) метод отдаёт `IAsyncEnumerable<Order>` + `AsSplitQuery()` — у клиента тысячи заказов, а без раздельных запросов Items×Payments дали бы декартово произведение строк в одном JOIN.
- (в) `GetProductBySku`: при заданном `warehouse` ищет по уникальной паре (Sku, Warehouse); при `warehouse == null` ищет только по SKU и, если найдено больше одного товара (SKU на разных складах), бросает `InvalidOperationException` вместо угадывания склада.
- (г) `GetLastShippedAtAsync` берёт `MAX(ShippedAt)` по отгруженным заказам клиента; так как возврат не nullable, отсутствие отгруженных заказов — исключение, а не null. Везде добавлен `AsNoTracking()` для read-only выгрузок.