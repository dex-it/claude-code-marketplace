Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-N2/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-N2/OrderRepository.cs

Решения:
- Order.Complexity (int, 1..5) добавлен в модель; диапазон закреплён CHECK-констрейнтом на уровне таблицы (`ToTable(t => t.HasCheckConstraint(...))`), а не только валидацией в коде — так ограничение переживёт любые пути записи в БД.
- Для CreatedAt колонка и её тип ("timestamp without time zone") не менялись — вместо этого добавлен `ValueConverter<DateTime, DateTime>`: при записи значение нормализуется в UTC и Kind сбрасывается в Unspecified (под тип колонки), при чтении Kind принудительно выставляется в Utc — код всегда получает `CreatedAt.Kind == DateTimeKind.Utc` независимо от таймзоны клиента, писавшего запись.
- Order -> Items и Order -> Payments сконфигурированы явно через HasMany/WithOne/HasForeignKey с обязательным (non-nullable) FK и DeleteBehavior.Cascade; soft-delete (IsDeleted + существующий HasQueryFilter) на эти связи не влияет, т.к. строка Order физически не удаляется.
- OrderRepository.ClearItemsAsync(Guid orderId): подгружает заказ с Items, вызывает order.Items.Clear() и SaveChangesAsync — поскольку OrderId у OrderItem обязательный (не nullable), EF Core удаляет осиротевшие строки, а не просто отвязывает их.
