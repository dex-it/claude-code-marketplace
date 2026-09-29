Изменённые файлы:
- **Model.cs** — добавлено `Order.Complexity` (int, 1..5) с CHECK-constraint в БД; для `CreatedAt` настроен `HasConversion` (запись: `ToUniversalTime()` + `Kind=Unspecified`, чтение: `Kind=Utc`), тип колонки `timestamp without time zone` не тронут; в `OnModelCreating` явно описаны связи `Order->Items` и `Order->Payments` (`HasMany/WithOne/HasForeignKey`, `OnDelete(Restrict)`).
- **OrderRepository.cs** — добавлен `ClearItemsAsync(Guid orderId)`: подгружает заказ с `Items`, очищает коллекцию, сохраняет.

Решения:
- Колонку `CreatedAt` не меняли (нужна DBA-отчётам); конвертер даёт гарантированный `Kind=Utc` при чтении в коде и корректную запись `DateTime.UtcNow`, учитывая что Npgsql запрещает `Kind=Utc` для `timestamp without time zone`.
- `Complexity` ограничен диапазоном на уровне БД (CHECK), а не только соглашением в коде.
- Связи `Order->Items/Payments` настроены с `Restrict`, чтобы хард-делет заказа не унёс дочерние записи молча (штатное удаление — только через `IsDeleted`); `ClearItemsAsync` полагается на стандартное поведение EF (orphan delete при обязательном FK) для физического удаления позиций.

Ответ также записан в `_answer.md`.