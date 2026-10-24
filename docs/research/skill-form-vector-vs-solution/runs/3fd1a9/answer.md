## Выполнено ✓

**Файлы:**
- `CustomerNotifier.cs` (новый)
- `_answer.md` (ответ)

**Решение:** Реализован `CustomerNotifier` с методом `NotifyCustomers`, соблюдающим правила SKILL.md:
- Дедупликация ID через `HashSet<Guid>` (исключает повторную обработку)
- Batching по 500 элементов (защита от деградации плана в PostgreSQL)  
- Проекция `Select(c => new { c.Email, c.Name })` перед `ToListAsync()` (загружаем только нужное, не раздуваем Change Tracker)
- Один `Where(c => batch.Contains(c.Id))` в SQL на batch, не N запросов в цикле