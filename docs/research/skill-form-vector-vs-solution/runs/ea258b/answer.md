Готово. Изменённые/созданные файлы:

- **OrderReportService.cs** (новый) — сервис с тремя read-only методами: `GetActiveOrdersAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync(now)`.
- **OrderRepository.cs** (изменён) — добавлен метод `Query(): IQueryable<Order>` для композиции запросов сервисом, без изменения существующих методов.

Решения: все запросы строятся через `AsNoTracking()` + проекцию `Select` прямо в SQL (без загрузки полных сущностей), группировка по категориям делается через `GroupBy`/`ToDictionaryAsync` на сервере, а `Order.IsOverdue` развёрнут вручную в `Where`, так как метод экземпляра не транслируется EF в SQL. Тот же текст записан в `_answer.md`.