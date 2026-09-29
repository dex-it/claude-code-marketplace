## Выполнено

**Созданные/изменённые файлы:**
- `OrderQueries.cs` - новый сервис

**Решения:**
- GetOrderByIdAsync: прямой запрос с Include для Items и Payments
- GetCustomerOrdersQuery: возвращает IQueryable для карточки всех заказов клиента, позволяя вызывающему коду применить Skip/Take (эффективно для тысяч заказов)
- GetProductBySkuAsync: поиск по SKU с опциональной фильтрацией по warehouse; если warehouse=null, возвращает первый найденный продукт
- GetLastShippedOrderDateAsync: максимальный ShippedAt клиента или DateTime.MinValue если нет отгруженных заказов

Ответ записан в `_answer.md`.