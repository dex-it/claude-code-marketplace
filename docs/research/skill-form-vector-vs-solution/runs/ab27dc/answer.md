Изменённые файлы:
- `Model.cs`: добавлены `Order.Complexity` и check-ограничение 1..5, конвертер для `CreatedAt`, связи Order -> Items и Order -> Payments.
- `OrderRepository.cs`: добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md`: этот ответ.

Решения:
- `Complexity` — обычное поле `int` с CHECK `BETWEEN 1 AND 5`, а не owned-тип из одного поля. Колонка `timestamp without time zone` не изменилась. `CreatedAt` пишется с `Kind=Unspecified` (UTC-значение), а при чтении помечается `Utc`. Без этого Npgsql 6+ отказывается писать `Utc` в такую колонку.
- Связи required и настроены с `OnDelete(Restrict)`: заказы удаляются мягко, поэтому каскада в БД нет. Из-за этого `Items.Clear()` бросил бы исключение в `SaveChanges`. Поэтому `ClearItems` загружает заказ с позициями через `Include` (фильтр `IsDeleted` применяется) и удаляет их явно через `RemoveRange` одним `SaveChanges`.
- Миграцию я не писал, в проекте их нет. Для уже существующих строк колонке `Complexity` нужно значение по умолчанию из 1..5: 0 не пройдёт проверку. Какое именно значение взять, должен решить бизнес.

Сборку и тесты я не запускал.