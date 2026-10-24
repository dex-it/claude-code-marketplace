Создан файл: `OrderQueries.cs` (новый сервис `OrderQueries` в namespace `Shop.Data`). Ответ также записан в `_answer.md`.

Решения:
- Карточка заказа и выгрузка заказов клиента используют `AsNoTracking()` и `AsSplitQuery()` — две коллекции (Items + Payments) в одном `Include` дают перемножение строк, критично при тысячах заказов клиента.
- `GetProductBySkuAsync(sku, warehouse)`: если warehouse передан — `SingleOrDefaultAsync` безопасен (уникальная пара sku+warehouse); если warehouse == null, а sku встречается на нескольких складах, не используем `Single()` вслепую — берём `Take(2)` и бросаем понятное исключение при неоднозначности.
- `GetLastShippedDateAsync`: агрегат `MaxAsync` считается в БД; метод возвращает non-nullable `DateTime`, поэтому при отсутствии отгруженных заказов явно бросается исключение вместо `!`-приведения null.