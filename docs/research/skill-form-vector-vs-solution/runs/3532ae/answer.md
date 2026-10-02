Готово. Сборку/тесты не запускал, как и требовалось.

**Созданные/изменённые файлы:**
- `OrderReportService.cs` (новый) — сервис с методами `GetActiveOrdersAsync()`, `GetActiveOrderCountsByCategoryAsync()`, `GetOverdueOrdersAsync(now)` и DTO `OrderReportItem(Id, CustomerName, Total, ItemCount)`.
- `OrderRepository.cs` (изменён) — добавлены `QueryActive()` и `QueryOverdue(now)`, возвращающие `IQueryable<Order>` с `AsNoTracking()`.

**Решения:**
- Данные берутся проекцией (`Select`) в DTO, а не через `Include`/lazy-loading `Customer`/`Items`, чтобы не тянуть лишние поля и не словить N+1 на `virtual Customer`.
- Условие просрочки продублировано как выражение `ShippedAt == null && CreatedAt.AddDays(3) < now` прямо в запросе (идентично `Order.IsOverdue`), т.к. вызов инстанс-метода сущности EF Core в SQL не транслирует.
- Репозиторий отдаёт составные `IQueryable`, материализация/группировка — в сервисе; все выборки `AsNoTracking`, т.к. только чтение.

Тот же текст записан в `_answer.md`.