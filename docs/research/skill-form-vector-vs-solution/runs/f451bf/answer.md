Изменённые файлы (новых нет, сборку и тесты не запускал):
- `Model.cs`: у `Order` появилось поле `Complexity`. В `OnModelCreating` настроены конвертер для `CreatedAt`, check-ограничение, значение по умолчанию и связи с Items и Payments. Навигации стали `virtual`.
- `OrderRepository.cs`: добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md`: этот ответ.

Решения:
- **Complexity:** тип `int`. Значения вне 1..5 не пройдут ни в коде (исключение в сеттере), ни в БД (`CK_Orders_Complexity`). Default = 1, чтобы при миграции существующие строки не нарушили ограничение: без него EF подставил бы 0.
- **CreatedAt:** колонка остаётся `timestamp without time zone`, в ней хранится UTC. При записи значение приводится к UTC со сброшенным Kind: Npgsql 6+ отказывается писать `Kind=Utc` в такую колонку. При чтении ставится `Kind=Utc`. Глобальный `EnableLegacyTimestampBehavior` не включал.
- **Связи и ClearItems:** Items удаляются каскадом, поэтому `ClearItems` может загрузить заказ через `Include`, вызвать `Items.Clear()` и сохранить, а EF удалит оторванные позиции. Payments стоят на `Restrict`: платежи никогда не удаляются каскадом. Навигации сделаны `virtual`, потому что `UseLazyLoadingProxies` иначе упадёт при построении модели. Мягко удалённый заказ `ClearItems` не находит и бросает `KeyNotFoundException`.
- **Не сделано:**
  - `Total` после очистки не пересчитывается.
  - Миграцию нужно сгенерировать.