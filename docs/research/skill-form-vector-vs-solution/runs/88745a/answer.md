## Созданные/изменённые файлы

- `OrderReportModels.cs` (новый) — `OrderSummaryDto(Id, CustomerName, Total, ItemsCount)`.
- `OrderRepository.cs` (изменён) — добавлены `GetActiveSummariesAsync()`, `GetActiveCountsByCategoryAsync()`, `GetOverdueSummariesAsync(DateTime now)`.
- `OrderReportService.cs` (новый) — `OrderReportService` с тремя методами: `GetActiveOrdersAsync()`, `GetActiveOrderCountsByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)`, вызывающими `OrderRepository`.

## Решения

Всё считается на стороне БД: `Select` в `OrderSummaryDto` (без `Include`/ленивой подгрузки `Customer`, `Items.Count` уходит подзапросом) и `GroupBy` по категориям с `Count()`, плюс `AsNoTracking()` — отчёт не должен тянуть целые сущности и трекать их.

Правило `Order.IsOverdue` продублировано как `Expression<Func<Order,bool>>` в репозитории вместо прямого вызова `o.IsOverdue(now)` внутри LINQ — инстанс-метод EF Core не транслирует в SQL. `now` должен приходить с тем же `DateTimeKind`, что и `CreatedAt` (`timestamp without time zone` → `Unspecified`) — отмечено в комментарии.

Тот же текст записан в `_answer.md`. Сборку/тесты не запускал, файлы вне рабочего каталога не трогал.