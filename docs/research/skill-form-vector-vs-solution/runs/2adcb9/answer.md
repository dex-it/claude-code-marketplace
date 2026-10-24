Изменённые/созданные файлы:
- `Model.cs` — добавлено `Order.Complexity` (int, 1..5) с check-constraint; для `CreatedAt` настроен `ValueConverter`, снимающий/восстанавливающий `DateTimeKind.Utc` на границе с БД без смены типа колонки; в `OnModelCreating` явно настроены связи `Order.Items`/`Order.Payments` как обязательные с `DeleteBehavior.Cascade`.
- `OrderRepository.cs` — добавлен `ClearItemsAsync(Guid orderId)`.
- `_answer.md` — записан этот же ответ.

Ключевые решения: Cascade для Items/Payments выбран, чтобы `order.Items.Clear()` не падал с `InvalidOperationException` (у обязательного FK при Restrict/ClientSetNull EF пытается обнулить его при разрыве связи). Для `CreatedAt` конвертер меняет Kind DateTime на границе с БД (Unspecified при записи, Utc при чтении), т.к. колонку `timestamp without time zone` менять нельзя, а Npgsql 8 требует Unspecified для такого типа.