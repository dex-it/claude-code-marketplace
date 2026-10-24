Готово. Сборку/тесты не запускал, как и просили.

**Изменённые/созданные файлы:**
- `Model.cs` — `Order.Complexity` (int 1..5 + CHECK-констрейнт в БД); `ValueConverter` для `CreatedAt`, снимающий `Kind` при записи и проставляющий `Utc` при чтении (тип колонки `timestamp without time zone` не тронут); явные связи `Order→Items`/`Order→Payments` в `OnModelCreating` (`HasForeignKey` + `IsRequired` + `Cascade`).
- `OrderRepository.cs` — метод `ClearItemsAsync(Guid orderId)`.
- `_answer.md` — тот же отчёт.

**Ключевые решения:**
- CreatedAt: конвертер вместо смены типа колонки — в БД остаётся naive timestamp (отчёты DBA не задеты), а в коде `Kind` всегда `Utc`.
- Complexity ограничен CHECK-констрейнтом на уровне БД, а не только в коде.
- Cascade + Required для Items/Payments нужны, чтобы `Items.Clear()` в `ClearItemsAsync` реально удалял позиции при `SaveChanges` (осиротевшие обязательные зависимости).