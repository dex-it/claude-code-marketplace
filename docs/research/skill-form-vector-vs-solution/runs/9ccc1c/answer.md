Созданные/изменённые файлы:
- **OrderRepository.cs** — изменён: добавлены записи `ActiveOrderSummary` и `CategoryOrderCount`, а также три метода: `GetActiveOrderSummariesAsync()`, `GetActiveOrderCountsByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)`.
- **OrderReportService.cs** — создан: сервис с методами `GetActiveOrdersAsync()`, `GetActiveOrderCountsByCategoryAsync()` (Dictionary<string,int>), `GetOverdueOrdersAsync(DateTime now)`.

Решения:
- Проекции (а) и (б) выполняются прямо в SQL через `Select`/`GroupBy` в репозитории — не тянем лишние поля и связанные сущности целиком.
- `Order.IsOverdue` — обычный C#-метод, EF Core не транслирует его в SQL, поэтому для (в) в репозитории продублировано то же условие с комментарием, что оно отражает правило `IsOverdue`.
- Глобальный `HasQueryFilter(!IsDeleted)` на `Order` уже отфильтровывает удалённые заказы во всех трёх запросах.

Ответ также записан в `_answer.md`. Сборку и тесты не запускал, как было указано.