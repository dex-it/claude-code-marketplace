Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E4-X3/Model.cs
- /Users/anonymous/.cache/review/pr280/runs2/E4-X3/OrderRepository.cs

Решения:
- Complexity (int, 1..5) добавлен на Order и ограничен через CK_Order_Complexity_Range (o.ToTable(t => t.HasCheckConstraint(...))) — валидность диапазона гарантирует БД, а не только код.
- CreatedAt: колонка осталась `timestamp without time zone`; добавлен ValueConverter<DateTime,DateTime> — при записи Kind приводится к Unspecified (как требует Npgsql для tz-less колонки), при чтении помечается Kind=Utc, так что в коде CreatedAt всегда UTC независимо от таймзоны клиента, а отчёты DBA не затронуты (тип и данные в колонке не меняются).
- Order -> Items и Order -> Payments сконфигурированы как required FK с OnDelete(DeleteBehavior.ClientCascade): в БД это NO ACTION (без каскада), но при разрыве связи в трекере (например, Items.Clear()) EF сам удаляет осиротевшие зависимые сущности в памяти, не бросая исключение из-за required-связи — это и используется в ClearItemsAsync.
- OrderRepository.ClearItemsAsync(Guid orderId): грузит Order с Include(Items) под трекингом, вызывает Items.Clear() и SaveChangesAsync — позиции удаляются благодаря ClientCascade.
