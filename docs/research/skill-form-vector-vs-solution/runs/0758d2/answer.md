## Созданные/изменённые файлы
- `OrderReportService.cs` (новый) — сервис `OrderReportService` с методами `GetActiveOrdersAsync()`, `GetActiveOrderCountsByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)`, DTO `OrderSummaryDto(Id, CustomerName, Total, ItemCount)`.
- `OrderRepository.cs` (изменён) — добавлены `ActiveOrders()` и `OverdueOrders(DateTime now)`, возвращающие `IQueryable<Order>` с `AsNoTracking()`.

## Решения
- `Order.IsOverdue` — метод экземпляра, EF не транслирует его в SQL, поэтому правило продублировано прямо в LINQ-запросе `OverdueOrders`.
- `CreatedAt` хранится как `timestamp without time zone`, поэтому `now` нормализуется в `Kind=Unspecified`, иначе Npgsql выбросит исключение при `Kind=Utc/Local`.
- Все методы работают через проекции и группировку на сервере с `AsNoTracking` — без лишней материализации сущностей.

Ответ также записан в `_answer.md`.