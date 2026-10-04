Готово. Сборку/тесты не запускал, как и было указано.

**Изменённые/созданные файлы:**
- `OrderRepository.cs` — добавлен метод `Query()` (`IQueryable<Order>` с `AsNoTracking()`, без материализации) как основа для построения отчётных запросов.
- `OrderReportService.cs` (новый) — три метода: `GetActiveOrdersAsync`, `GetActiveOrderCountsByCategoryAsync`, `GetOverdueOrdersAsync(DateTime now)`.

**Решения:**
- Везде проекции в DTO вместо полных сущностей, группировка/агрегаты выполняются в SQL (`GroupBy`+`Count()` до `ToListAsync`), а не после материализации.
- `Order.IsOverdue` инлайнен прямо в LINQ (`ShippedAt == null && CreatedAt.AddDays(3) < now`), т.к. вызов метода экземпляра сущности не транслируется в SQL; `now` должен иметь `DateTime.Kind = Unspecified` из-за колонки `timestamp without time zone`.

Тот же текст записан в `_answer.md`.