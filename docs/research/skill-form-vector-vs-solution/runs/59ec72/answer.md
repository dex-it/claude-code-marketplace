Готово! Выполнены все четыре задачи:

**Измененные файлы:**
- `Model.cs` - добавлена Complexity, настроен конвертер CreatedAt, добавлены IsDeleted в OrderItem/Payment, конфигурированы связи и query filters
- `OrderRepository.cs` - добавлен метод ClearItemsAsync
- `_answer.md` - создан файл с описанием решений

**Основные решения:**
- **(а)** Complexity добавлено как `int` свойство с дефолтом 1 в Order
- **(б)** Value converter в OnModelCreating гарантирует UTC в коде при сохранении в `timestamp without time zone` 
- **(в)** Добавлены IsDeleted и query filters для OrderItem/Payment, явная конфигурация связей с cascade delete
- **(г)** ClearItemsAsync использует ExecuteUpdateAsync с IgnoreQueryFilters для эффективного мягкого удаления позиций