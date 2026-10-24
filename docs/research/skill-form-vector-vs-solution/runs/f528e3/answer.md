Готово! Выполнены все четыре задачи:

**Изменённые файлы:**
- **Model.cs** — добавлено `int Complexity` в Order, конфигурация для UTC маппинга CreatedAt (с `HasConversion()`), настройка каскадного удаления для связей Items и Payments
- **OrderRepository.cs** — добавлен метод `ClearItems(Guid orderId)` с удалением позиций и SaveChangesAsync()

**Ключевые решения:** 
- Complexity с дефолтом 1, конфигурируется в OnModelCreating. 
- CreatedAt маппируется через `HasConversion()` — БД вернёт значение, и оно будет помечено как UTC в памяти, колонка БД (timestamp without time zone) не меняется.
- Связи Items и Payments используют `OnDelete(DeleteBehavior.Cascade)` для согласованного удаления при soft delete заказа.

Результат записан в `_answer.md`.