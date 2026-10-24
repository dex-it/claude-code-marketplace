Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-W2/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-W2/OrderRepository.cs

Решения:
- Complexity (1..5) добавлен как обычный int-property на Order; ограничение диапазона обеспечено CHECK-констрейнтом `CK_Order_Complexity_Range` в OnModelCreating, а не только в коде.
- CreatedAt: колонка осталась "timestamp without time zone" (не трогали ради отчётов DBA), но добавлен ValueConverter, который только снимает/восстанавливает DateTimeKind (без сдвига момента времени, т.к. в коде пишется DateTime.UtcNow) - это убирает несовместимость с Npgsql 6+ (он не даёт писать Kind=Utc в tz-less колонку) и гарантирует, что при чтении CreatedAt всегда будет Kind=Utc независимо от таймзоны клиента.
- Order -> Items сконфигурирован как Cascade (позиции не существуют вне заказа, это же правило удаляет orphan-строки при Items.Clear()), Order -> Payments - как Restrict (платежи - финансовые записи, их нельзя терять при случайном физическом удалении заказа; soft-delete всё равно не физическое удаление).
- Добавлен OrderRepository.ClearItemsAsync(Guid orderId): подгружает заказ с Include(Items), очищает коллекцию и делает SaveChangesAsync - EF удаляет orphan OrderItem благодаря required-связи.
