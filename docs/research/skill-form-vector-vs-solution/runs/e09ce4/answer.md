Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, 1..5) + вся конфигурация в `OnModelCreating`; маппинг `CreatedAt`; связи `Order->Items` и `Order->Payments`.
- `OrderRepository.cs` — добавлен метод `ClearItems(Guid orderId)`.
- `_answer.md` — этот же ответ.

Решения:
- `CreatedAt`: колонку не тронул (`timestamp without time zone`), добавил `HasConversion` — на запись нормализую в UTC и сбрасываю `Kind` в `Unspecified` (иначе Npgsql не даст писать `Kind=Utc` в `timestamp`), на чтение помечаю `Kind=Utc` без сдвига значения. В коде всегда UTC независимо от таймзоны клиента.
- Связи `Order->Items`/`Order->Payments` настроены с `DeleteBehavior.Restrict`: раз Order удаляется мягко (`IsDeleted`), физический каскад на дочерние таблицы не нужен и опасен при случайном хард-делете.
- `ClearItems` реализован через `ExecuteDeleteAsync` (один SQL `DELETE ... WHERE OrderId = ...`), а не через `Items.Clear()+SaveChanges`, чтобы не зависеть от `DeleteBehavior` связи и не тянуть позиции в Change Tracker.
- `Complexity` дополнительно защищён check-constraint `CK_Order_Complexity_Range` на уровне БД.