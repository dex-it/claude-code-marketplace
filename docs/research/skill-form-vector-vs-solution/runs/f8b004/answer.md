Готово.

**Изменённые/созданные файлы:**
- `OrderRepository.cs` — добавлены `ActiveOrderReportLine` (record) и методы `GetActiveOrderLinesAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync(DateTime now)`.
- `OrderReportService.cs` (новый) — сервис с тремя read-only методами над `OrderRepository`.

**Решения:** активные заказы и группировку по категориям строю прямо в IQueryable (агрегаты считает БД); просроченные фильтрую выражением `ShippedAt == null && CreatedAt.AddDays(3) < now`, дублирующим формулу `Order.IsOverdue` (метод на сущности нельзя транслировать в SQL напрямую); глобальный query filter `!IsDeleted` из `ShopDbContext` применяется автоматически, отдельно не дублирую.

Тот же текст записан в `_answer.md`.