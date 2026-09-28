Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-W4/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-W4/OrderRepository.cs

Решения:
- Order.Complexity (int) добавлен в модель; диапазон 1..5 закреплён check-constraint'ом в БД (`ToTable(t => t.HasCheckConstraint(...))`), а не только комментарием, чтобы бизнес-правило нельзя было обойти в обход EF.
- CreatedAt остаётся "timestamp without time zone" (тип колонки не тронут), но получил `HasConversion` с явным ValueConverter: перед записью Kind обнуляется до Unspecified (иначе Npgsql 6+ бросает исключение на DateTime с Kind=Utc), при чтении Kind принудительно восстанавливается в Utc — в коде CreatedAt всегда UTC независимо от таймзоны клиента.
- Order -> Items и Order -> Payments явно сконфигурированы в OnModelCreating через HasMany/WithOne/HasForeignKey с `DeleteBehavior.Restrict`: раз Order удаляется мягко (IsDeleted + HasQueryFilter), полагаться на каскад в БД не нужно, а Restrict защищает от случайной потери дочерних строк при реальном DELETE в обход soft-delete.
- OrderRepository.ClearItems(orderId) подгружает заказ с Include(Items), очищает коллекцию и делает SaveChangesAsync — EF сам удалит "осиротевшие" OrderItem, т.к. OrderId обязателен.
