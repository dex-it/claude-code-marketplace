## Изменённые/созданные файлы
- `OrderRepository.cs` — добавлен метод `GetActiveOrdersWithDetailsAsync()`.
- `OrderReportService.cs` (новый) — сервис `OrderReportService` с методами `GetActiveOrdersAsync()`, `GetActiveOrdersCountByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)`.

## Решения
- «Активный» заказ = `Status == "active"`; источник данных — один метод `OrderRepository.GetActiveOrdersWithDetailsAsync()` с `Include(Customer)`, `Include(Items)` и `AsNoTracking()` (lazy loading в проекте не включён, а запросы read-only для отчётов).
- Просроченные заказы считаются среди активных по `Order.IsOverdue(now)`; наружу отдаются DTO-record'ы (`ActiveOrderReportItem`, `OverdueOrderReportItem`), а не сами EF-сущности.
- Сборка/тесты не запускались согласно ограничениям.

Тот же текст записан в `_answer.md`.