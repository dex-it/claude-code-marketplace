Готово! Выполнены все четыре пункта поручения:

## Изменённые файлы
- **Model.cs** — добавлено Complexity, настроена конвертация CreatedAt для UTC, конфигурированы каскадные связи
- **OrderRepository.cs** — добавлен метод ClearItems
- **_answer.md** — создан файл с результатами

## Краткое резюме решений
1. **Complexity**: добавлено поле `int Complexity` в Order
2. **CreatedAt UTC**: использован `HasConversion` с `DateTime.SpecifyKind(..., DateTimeKind.Utc)` — колонка остаётся `timestamp without time zone`, но при чтении значение помечается как UTC
3. **Soft-delete каскад**: для Items и Payments настроены `OnDelete(DeleteBehavior.Cascade)` с правильной конфигурацией связей
4. **ClearItems**: метод загружает заказ через `Include(o => o.Items)`, очищает коллекцию `Clear()` и сохраняет