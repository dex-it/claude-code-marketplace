Готово. Сборку/тесты не запускал, как и указано.

**Файлы:**
- `OrderRepository.cs` — добавлен `Query()` → `IQueryable<Order>` с `AsNoTracking()` для композиции.
- `OrderReportService.cs` (новый) — `GetActiveOrdersAsync`, `GetActiveOrderCountByCategoryAsync`, `GetOverdueOrdersAsync(now)`.

**Решения:**
- `IsOverdue` инлайнен в `Where` (`ShippedAt == null && CreatedAt.AddDays(3) < now`), т.к. вызов C#-метода внутри LINQ-выражения EF Core не транслирует в SQL.
- Все методы — сразу проекция в `OrderReportDto` (Id, имя клиента, Total, число позиций), без `Include`; группировка по категориям — `GroupBy`+`Count` в SQL, не в памяти.

Ответ также записан в `work/_answer.md`.