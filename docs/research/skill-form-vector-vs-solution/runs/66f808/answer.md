Изменённые файлы:
- `Model.cs` — свойство `Order.Complexity` (int, 1..5) с check-constraint'ом в БД; `HasConversion` для `CreatedAt` (Unspecified при записи, Utc при чтении), тип колонки не менялся; в `OnModelCreating` настроены `Order.Items`/`Order.Payments` через `HasForeignKey(...).OnDelete(DeleteBehavior.Restrict)`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — тот же ответ.

Решения: диапазон `Complexity` защищён check-constraint'ом в БД, а не только в коде; конвертер для `CreatedAt` гарантирует `Kind=Utc` в коде без изменения колонки `timestamp without time zone`; FK для Items/Payments сделаны `Restrict` (Order только помечается `IsDeleted`, каскад в БД не нужен и опасен), поэтому `ClearItems` удаляет позиции через `RemoveRange`, а не `Items.Clear()`, чтобы не поймать `InvalidOperationException` на required-связи.