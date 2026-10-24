Готово. Выполнены все четыре части поручения:

**Изменённые файлы:**
- `Model.cs` — добавлено свойство Complexity, конвертер CreatedAt с UTC-нормализацией, конфигурация связей с ClientCascade
- `OrderRepository.cs` — добавлен метод ClearItemsAsync

**Решения:**
- **(а)** Complexity добавлен как `int` свойство в Order модель (диапазон 1..5 задаётся бизнес-логикой)
- **(б)** CreatedAt маппится с двусторонней нормализацией: на запись код приводит UtcNow к Unspecified (сохраняя UTC-значение), на чтение помечает как Utc; колонка `timestamp without time zone` остаётся как требует DBA
- **(в)** Order → Items и Order → Payments настроены с `OnDelete(DeleteBehavior.ClientCascade)` — EF контролирует удаление в памяти, совместимо с soft-delete фильтром
- **(г)** ClearItems загружает Order с Include(Items) и очищает коллекцию перед SaveChanges