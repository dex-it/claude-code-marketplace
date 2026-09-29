## Готово

Создал **OrderQueries.cs** с четырьмя методами:

| Созданный файл | Описание |
|---|---|
| `OrderQueries.cs` | Сервис с методами для работы с заказами |

**Решения:**
- **GetOrderDetailsAsync** — загружает заказ с Include для Items и Payments
- **GetCustomerOrdersQuery** — возвращает IQueryable (не List) для пагинации больших выборок через Skip/Take, AsNoTracking для производительности
- **GetProductBySkuAsync** — если warehouse не указан (null), ищет по SKU; иначе фильтрует по обоим полям
- **GetLastShippedDateAsync** — возвращает дату последнего отгруженного заказа или DateTime.MinValue, если их нет

Результат записан в `_answer.md`.