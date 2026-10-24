Изменённые/созданные файлы:
- `OrderRepository.cs` — добавлен метод `Query()`, возвращающий `IQueryable<Order>` для композиции read-запросов.
- `OrderReportService.cs` (новый) — сервис с тремя read-only методами: `GetActiveOrdersAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync`, плюс DTO `OrderReportRow`.

Решения: все методы используют `Query().AsNoTracking()` с проекцией в `Select` (без `Include`, чтобы избежать N+1 на `Customer.Name`/`Items.Count`); группировка по категориям идёт через `GroupBy`+`ToDictionaryAsync`, агрегация выполняется в SQL; правило `Order.IsOverdue` вручную раскрыто в `Where`, так как вызов метода экземпляра сущности не транслируется EF Core в SQL.

Тот же текст записан в `_answer.md`.