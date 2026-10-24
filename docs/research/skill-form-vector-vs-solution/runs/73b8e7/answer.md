## Готово

**Созданные файлы:**
- `OrderQueries.cs` — сервис с четырьмя методами

**Решения:**
- **(а) GetOrderCardAsync**: Include для Items и Payments без AsSplitQuery (одна сущность — JOIN эффективнее).
- **(б) GetCustomerOrdersAsync**: AsSplitQuery разбивает на 3 запроса (Orders, Items, Payments отдельно) — избегает cartesian explosion при тысячах заказов.
- **(в) GetProductBySkuAsync**: условный Where `(warehouse == null || p.Warehouse == warehouse)` — один запрос для обоих случаев.
- **(г) GetLastShippedDateAsync**: фильтр и OrderByDescending на сервере, Select на DateTime.Value, вернёт default(DateTime) если нет отгруженных.

Все методы используют `AsNoTracking()` (read-only), фильтры в `Where` до Include (no N+1), соответствует SKILL.md.