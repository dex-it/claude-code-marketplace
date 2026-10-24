## Изменённые/созданные файлы

- **`OrderReportService.cs`** (новый) — сервис `OrderReportService` с методами `GetActiveOrdersAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync(now)`, и DTO `ActiveOrderReportItem`, `OverdueOrderReportItem`.
- **`OrderRepository.cs`** (изменён) — добавлен метод `Query()`, возвращающий `IQueryable<Order>` с `AsNoTracking()`.

## Решения

Все три отчёта строятся через `IQueryable`-композицию над `OrderRepository.Query()`: фильтрация, `GroupBy`/`Count` и проекция в DTO выполняются в SQL (не в памяти), с `AsNoTracking()`. Правило `Order.IsOverdue(now)` продублировано инлайн в `Where`, так как вызов экземплярного метода в LINQ-выражении не транслируется EF Core. «Активные» заказы — `Status == "active"`, глобальный фильтр `!IsDeleted` применяется автоматически из `ShopDbContext`.

Тот же текст записан в `_answer.md`.