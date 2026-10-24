Готово! Создан сервис OrderQueries с четырьмя методами.

## Созданные/изменённые файлы
- **OrderQueries.cs** (новый) - сервис с методами запросов к заказам и товарам

## Решения

**(а, б)** Оба метода используют `AsNoTracking()` и `Include()` для загрузки связанных Items и Payments. `GetCustomerOrdersAsync` применяет `AsSplitQuery()` для эффективной работы с тысячами заказов — это предотвращает декартово произведение при Join множественных коллекций.

**(в)** `GetProductBySkuAsync` поддерживает null warehouse через условие `(warehouse == null || p.Warehouse == warehouse)` — если склад не указан, выбирает первый найденный товар; SKU уникален на каждом складе.

**(г)** `GetLastShippedDateAsync` вычисляет Max на сервере БД с фильтром `ShippedAt != null`, возвращая `DateTime.MinValue` при отсутствии отгруженных заказов (гарантирует non-nullable DateTime).