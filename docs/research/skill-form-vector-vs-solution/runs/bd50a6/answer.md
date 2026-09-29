Готово. Изменённые/созданные файлы:

- `Model.cs` — добавлено `Order.Complexity` (int, 1..5) с check-constraint; UTC-конвертер для `CreatedAt` (колонка `timestamp without time zone` не менялась); явные связи `Order → Items` и `Order → Payments` в `OnModelCreating`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — тот же ответ, записан в каталог проекта.

Ключевые решения:
- `CreatedAt`: `ValueConverter` снимает `Kind` до `Unspecified` на запись (после нормализации к UTC) и явно ставит `Kind=Utc` на чтение — Npgsql 8 иначе отклоняет `DateTime` с `Kind=Utc` для `timestamp without time zone`, а в коде всегда остаётся UTC.
- Связи с `Items`/`Payments` настроены как required с `DeleteBehavior.ClientCascade`: каскад работает только для отслеживаемого графа (нужно для `Clear()`), а в схеме БД не появляется `ON DELETE CASCADE`, чтобы случайный физический `DELETE` по `Order` не сносил зависимые записи в обход soft-delete.
- `ClearItems` сначала грузит `Order` с `Include(Items)`, иначе `Clear()` на непрогруженной коллекции ничего не удалит.