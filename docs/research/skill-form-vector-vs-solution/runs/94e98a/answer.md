## Изменённые/созданные файлы

- `OrderRepository.cs` — добавлены `QueryActive()` и `QueryOverdue(DateTime now)`, возвращающие `IQueryable<Order>` (без материализации, `AsNoTracking`).
- `OrderReportService.cs` (новый) — три read-only метода: `GetActiveOrdersAsync()`, `GetActiveOrderCountByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)`.

## Решения

Репозиторий отдаёт `IQueryable`, а не готовые списки, чтобы фильтрация/группировка/подсчёт выполнялись на стороне БД, а не в памяти. Условие `IsOverdue` инлайнировано в LINQ (`ShippedAt == null && CreatedAt.AddDays(3) < now`), т.к. вызов метода экземпляра не транслируется EF Core; `now` должен быть с `DateTimeKind.Unspecified` под колонку `timestamp without time zone`. Тот же ответ записан в `_answer.md`.