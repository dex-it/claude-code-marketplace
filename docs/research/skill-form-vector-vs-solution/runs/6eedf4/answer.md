**Созданные файлы:**
- `OrderQueries.cs` — новый сервис `OrderQueries` (namespace `Shop.Data`) с методами `GetOrderCardAsync`, `StreamOrdersByCustomerAsync`, `GetProductBySku`, `GetLastShippedAtAsync`.
- `_answer.md` — тот же ответ.

**Ключевые решения:**
1. Для карточки заказа и выгрузки по клиенту использую `AsSplitQuery` (две коллекции `Items`/`Payments` иначе дают декартово произведение), а для выгрузки — `IAsyncEnumerable<Order>` вместо `List<Order>`, поскольку у клиента могут быть тысячи заказов.
2. `GetProductBySku` при `warehouse == null` и неоднозначном SKU (несколько складов) бросает исключение через `SingleOrDefaultAsync`, а не возвращает случайную строку — это единственный безопасный вариант при неполных входных данных от бизнеса.
3. `GetLastShippedAtAsync` возвращает non-nullable `DateTime`, при отсутствии отгруженных заказов явно бросает `InvalidOperationException`, так как контракт метода не допускает "нет значения".