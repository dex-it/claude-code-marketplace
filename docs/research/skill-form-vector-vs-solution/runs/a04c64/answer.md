Изменённые/созданные файлы:
- `OrderRepository.cs` — добавлены `QueryActive()` и `Query()`: композируемые `IQueryable<Order>` с `AsNoTracking()`, без материализации в репозитории.
- `OrderReportService.cs` (новый) — три read-only метода: `GetActiveOrdersAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync(DateTime now)`, плюс DTO `ActiveOrderSummary`/`OverdueOrderSummary`.

Решения:
- Запросы строятся на `IQueryable` из репозитория и проецируются `Select`'ом в DTO до материализации, без лишних Include; `AsNoTracking`, т.к. только чтение.
- `Order.IsOverdue(now)` — обычный C#-метод, не транслируется в SQL, поэтому его условие продублировано инлайн в LINQ, чтобы фильтрация шла на стороне БД.
- Группировка по категориям (`GroupBy`+`Count()`) выполняется в БД; в `Dictionary` конвертируется уже маленький агрегированный результат после `ToListAsync`.

Тот же текст записан в `_answer.md`.