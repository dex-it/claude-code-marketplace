## Выполнено ✓

**Изменённые файлы:**
- `Model.cs` — добавлено свойство Complexity, настроены конвертеры UTC для CreatedAt и связи Order→Items/Payments
- `OrderRepository.cs` — добавлен метод ClearItems(Guid orderId)
- `_answer.md` — создан файл с решениями

**Ключевые решения:**

**(а) Complexity:** Добавлено свойство `int Complexity` к Order с конфигурацией DefaultValue = 1 в OnModelCreating.

**(б) CreatedAt UTC:** Применён `HasConversion()` с `ToUniversalTime()` при записи в БД и `DateTime.SpecifyKind(..., DateTimeKind.Utc)` при чтении, обеспечивая UTC-время в коде при сохранении колонки "timestamp without time zone" в БД.

**(в) Связи с soft delete:** Явно настроены relationships Order→Items и Order→Payments через `HasMany().WithOne()` с `OnDelete(DeleteBehavior.Cascade)`.

**(г) ClearItems:** Метод загружает Order с Include(Items), очищает коллекцию и вызывает SaveChangesAsync().