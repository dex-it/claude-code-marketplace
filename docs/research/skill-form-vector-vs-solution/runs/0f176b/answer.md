Готово! Выполнены все четыре пункта задания:

## Измененные файлы
- **Model.cs** — добавлено свойство `Complexity` в Order; настроено преобразование CreatedAt для UTC через ValueConverter; сконфигурированы каскадные удаления для Items и Payments
- **OrderRepository.cs** — добавлен метод `ClearItemsAsync(Guid orderId)` для удаления позиций заказа

## Ключевые решения
**CreatedAt UTC:** Используется `.HasConversion()` с `ToUniversalTime()` при сохранении и `SpecifyKind(Utc)` при чтении, колонка остается без изменений как `timestamp without time zone`. **Каскадное удаление:** Явно настроены связи через fluent API с `DeleteBehavior.Cascade` для Items и Payments, что соответствует пункту 19-20 в SKILL.md о soft-delete и разрыве связей. **ClearItems:** Асинхронный метод явно загружает и удаляет OrderItems из БД (не просто очищает коллекцию в памяти).

Ответ записан в `_answer.md`.