## Созданные/изменённые файлы
- Создан `OrderReportService.cs` — сервис `OrderReportService` с методами `GetActiveOrdersAsync()`, `GetActiveOrderCountsByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)` и DTO-записями `ActiveOrderReportItem`, `OverdueOrderReportItem`.
- Изменён `OrderRepository.cs` — добавлен метод `Query()`, возвращающий `IQueryable<Order>` с `AsNoTracking()`, для композиции read-запросов.

## Решения
- Все три метода строятся через `Query().Where(...).Select(...)`/`GroupBy(...)` — фильтрация, группировка и подсчёты выполняются в SQL, без `Include` и без материализации полных сущностей.
- `Order.IsOverdue` раскрыт прямо в `Where` (метод сущности EF не транслирует в SQL).
- Группировка по категориям идёт в SQL, `ToDictionary` применяется уже к небольшому агрегированному результату.

Тот же текст записан в `_answer.md`.