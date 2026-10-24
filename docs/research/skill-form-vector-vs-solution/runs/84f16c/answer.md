Готово. Изменённые/созданные файлы:
- `OrderRepository.cs` — добавлены `Query()` и `Active()` (`IQueryable<Order>` с `AsNoTracking()`), чтобы репозиторий не материализовывал выборку заранее.
- `OrderReportService.cs` (новый) — три read-only метода: `GetActiveOrdersAsync`, `GetActiveOrderCountByCategoryAsync`, `GetOverdueOrdersAsync`.

Решения: проекции через `Select` (включая `Items.Count` как агрегат) и `GroupBy` выполняются на стороне БД без лишних сущностей/трекинга; условие `IsOverdue` продублировано как выражение, так как сам метод не транслируется в SQL, а параметр `now` должен быть `DateTimeKind.Unspecified` из-за колонки `timestamp without time zone`. Тот же текст записан в `_answer.md`.