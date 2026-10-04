## Изменённые файлы

- `Model.cs` — добавлено `Order.Complexity` (int, `IsRequired()` + CHECK `CK_Order_Complexity_Range` 1..5); конверсия `CreatedAt` через `HasConversion` (тип колонки не менялся — `timestamp without time zone`, в коде всегда `Kind == Utc`); в `OnModelCreating` явно настроены `Order -> Items` и `Order -> Payments` (`HasMany().WithOne().HasForeignKey(...).IsRequired().OnDelete(DeleteBehavior.ClientCascade)`).
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.

## Решения

- `CreatedAt`: конвертер приводит значение к UTC на запись и помечает `Kind=Utc` на чтение без сдвига — колонка не хранит TZ, поэтому это корректно ровно потому, что приложение и так пишет только UTC.
- Для обеих связей выбран `DeleteBehavior.ClientCascade`: required FK + разрыв связи (`Items.Clear()`) не бросает `InvalidOperationException`, как было бы при `Restrict`/`ClientSetNull`, но в БД не появляется `ON DELETE CASCADE`, так что случайный физический `DELETE` заказа в обход soft-delete не утянет дочерние записи.
- Диапазон `Complexity` закреплён CHECK-constraint'ом в БД, а не только на уровне кода.

Ответ также записан в `_answer.md`.