Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-N1/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-N1/OrderRepository.cs

Решения:
- Complexity (int, 1..5) добавлен как обычное required-свойство Order; диапазон 1..5 закреплён не в C#, а в БД через `HasCheckConstraint("CK_Order_Complexity_Range", ...)`, чтобы недопустимое значение отсекалось независимо от вызывающего кода.
- Для CreatedAt колонка осталась "timestamp without time zone" (HasColumnType не менялся), но добавлен ValueConverter: при записи Kind сбрасывается в Unspecified (иначе Npgsql 8 кидает исключение на запись Utc в тип без TZ), при чтении Kind принудительно ставится в Utc — в коде везде видно только UTC, отчёты DBA видят прежний тип колонки.
- В OnModelCreating явно описаны Order->Items и Order->Payments как HasMany().WithOne().HasForeignKey(...) с DeleteBehavior.Cascade; это поведение относится к физическому удалению строки Order, а не к soft-delete через IsDeleted (существующий HasQueryFilter не трогали).
- OrderRepository.ClearItems(Guid orderId): грузит Order с Include(Items), делает order.Items.Clear() и SaveChangesAsync — благодаря настроенной required-связи EF помечает осиротевшие OrderItem на удаление.
