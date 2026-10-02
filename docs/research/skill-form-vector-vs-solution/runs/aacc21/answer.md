## Изменённые/созданные файлы
- `OrderQueries.cs` (новый) — сервис с методами `GetOrderCardAsync`, `GetCustomerOrdersAsync`, `GetProductBySkuAsync`, `GetLastShippedDateAsync`.

## Решения
- Карточку заказа читаем одним запросом с двумя `Include` без `AsSplitQuery` (PK гарантирует одну строку, лишние round-trip'ы не нужны); все выборки — `AsNoTracking`.
- Для тысяч заказов клиента используем `AsSplitQuery` (иначе декартово произведение Items×Payments на каждый заказ) с `OrderBy` для стабильной корреляции.
- `GetProductBySkuAsync`: SKU уникален только вместе со складом, поэтому при `warehouse == null` не используем `Single` вслепую — явно проверяем число совпадений и бросаем исключение при неоднозначности.
- `GetLastShippedDateAsync` возвращает не-nullable `DateTime`: сначала фильтруем `ShippedAt != null`, потом `.Value`/`MaxAsync()`, без магического `!` без проверки.

Ответ также записан в `_answer.md`.