## Изменённые файлы
- `Model.cs` — добавлено поле `Order.Complexity` (int, 1..5), конфигурация в `OnModelCreating`
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`

## Решения
- `Complexity` — плоское свойство `int`, не Owned-Type (правило SKILL про VO из одного поля); диапазон 1..5 закреплён CHECK-constraint в БД.
- `CreatedAt`: колонка осталась `timestamp without time zone`; добавлен `HasConversion` — на запись `ToUniversalTime()` + `SpecifyKind(Unspecified)` (иначе Npgsql 8 бросает на `Kind=Utc` в `timestamp`), на чтение `SpecifyKind(Utc)`. В коде дата всегда UTC, формат колонки для DBA не тронут.
- Связи `Order → Items`/`Payments` явно заданы с `OnDelete(Restrict)` (required FK + soft-delete родителя — защита от физического каскада при случайном `DELETE`). `ClearItems` загружает заказ с Items, чистит коллекцию и сохраняет — EF физически удалит позиции, т.к. FK обязательный.

Ответ также записан в `_answer.md`.