Готово. Создал **OrderQueries.cs** с четырьмя методами:

- **GetOrderCardAsync** — карточка заказа с позициями и платежами, использует `AsSplitQuery()` для избежания Cartesian product
- **GetCustomerOrdersAsync** — все заказы клиента с проекцией (эффективно для тысяч заказов), не грузит полные entities
- **GetProductBySkuAsync** — поиск по SKU с опциональной фильтрацией по warehouse
- **GetLastShippedDateAsync** — дата последней отгрузки (возвращает DateTime.MinValue если нет)

Все методы следуют SKILL.md: `AsNoTracking()` для read-only, `AsSplitQuery()` для множественных Include, `Select()` проекция вместо `ToList()` на больших объемах.

Файлы: `OrderQueries.cs`, `_answer.md`