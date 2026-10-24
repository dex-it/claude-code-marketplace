## Изменённые/созданные файлы
- `OrderRepository.cs` — добавлен метод `IQueryable<Order> Query()` (AsNoTracking) для композиции отчётных запросов.
- `OrderReportService.cs` (новый) — сервис `OrderReportService` с методами `GetActiveOrdersAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync` и DTO `ActiveOrderReportItem`, `OverdueOrderReportItem`.
- `_answer.md` — тот же ответ записан туда.

Решения: фильтрация/группировка/подсчёт позиций делаются в SQL через `Select`/`GroupBy` до материализации (без N+1 и лишней загрузки данных); правило `IsOverdue` продублировано инлайн в LINQ, потому что EF Core не может транслировать вызов инстанс-метода `Order.IsOverdue` в SQL — соответствие зафиксировано комментарием.