Изменённые файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, 1..5 через `HasCheckConstraint`); `CreatedAt` замаплен через `ValueConverter` (переключает `DateTime.Kind` без арифметики) — колонка `timestamp without time zone` не тронута, в коде всегда UTC; в `OnModelCreating` явно настроены `Order -> Items` (`Cascade`) и `Order -> Payments` (`Restrict`).
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)`: грузит заказ с `Items`, `order.Items.Clear()`, `SaveChangesAsync()`.

Решения: `Items` — `Cascade`, потому что связь обязательная и только так `Clear()` реально удалит строки (иначе `ClearItems` упадёт на "severed relationship"). `Payments` — `Restrict`, чтобы случайное физическое удаление заказа не утаскивало платежи молча (soft-delete и так не трогает детей, это `UPDATE`). Конвертер `CreatedAt` не пересчитывает часы, только `Kind`, поэтому данные в колонке для DBA-отчётов не меняются.

Тот же текст записан в `/Users/anonymous/.cache/research/runs/5d1b70/work/_answer.md`.