Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-O1/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-O1/OrderRepository.cs

Решения:
- Complexity — обычный `int` на Order (не Owned Type, т.к. одно поле без инварианта — по правилу skill), диапазон 1..5 закреплён CHECK-constraint'ом в БД (`CK_Order_Complexity_Range`), а не только в C#.
- CreatedAt: колонка осталась `timestamp without time zone`, добавлен `ValueConverter<DateTime,DateTime>` — на запись значение нормализуется в UTC и помечается `Kind=Unspecified` (иначе Npgsql 6+ бросает на `Kind=Utc` для этого типа колонки), на чтение помечается обратно `Kind=Utc`. В коде CreatedAt теперь всегда гарантированно UTC независимо от таймзоны клиента/сервера.
- Order -> Items и Order -> Payments настроены в OnModelCreating как required FK с `OnDelete(DeleteBehavior.Restrict)`: при soft-delete (IsDeleted) это не влияет на UPDATE, но защищает от случайного физического `DELETE FROM "Orders"` в обход приложения — такой DELETE упадёт на FK-constraint, а не молча снесёт Items/Payments каскадом.
- ClearItems(Guid orderId) в OrderRepository: загружает Order с Include(Items), явно удаляет позиции через `_db.RemoveRange(order.Items)` (не полагаясь на orphan-cascade поведения навигации, которое при Restrict не сработало бы), затем `Items.Clear()` и `SaveChangesAsync()`. Заказ, уже помеченный IsDeleted, глобальный query filter исключает из выборки — метод для него тихо не делает ничего (заказ "не найден").
