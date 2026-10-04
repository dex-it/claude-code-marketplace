## Изменённые файлы

- **Model.cs** — добавлено `Order.Complexity` (int, CHECK 1..5 через `ToTable(t => t.HasCheckConstraint(...))` — актуальный API EF Core 8, старый `HasCheckConstraint` на entity builder deprecated); для `CreatedAt` добавлен `ValueConverter`, снимающий `Kind=Utc` перед записью (Npgsql 8 иначе бросает исключение при записи UTC в `timestamp without time zone`) и проставляющий `Kind=Utc` при чтении — сама колонка/тип не тронуты, в коде `CreatedAt` всегда UTC вне зависимости от таймзоны клиента; в `OnModelCreating` явно настроены `Order.Items`/`Order.Payments` через `HasMany().WithOne().HasForeignKey(...).OnDelete(Cascade)`.
- **OrderRepository.cs** — добавлен `ClearItems(Guid orderId)`: подгружает заказ с `Items`, очищает коллекцию, `SaveChangesAsync()` удаляет строки (FK обязательный + Cascade).

Ответ также записан в `_answer.md`.