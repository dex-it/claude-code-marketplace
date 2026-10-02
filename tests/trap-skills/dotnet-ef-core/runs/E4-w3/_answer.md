Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs/E4-W3/Model.cs
- /Users/anonymous/.cache/review/pr280/runs/E4-W3/OrderRepository.cs

Решения:
- Complexity (int, 1..5) добавлен как обычное required-свойство Order + CHECK-констрейнт `CK_Order_Complexity_Range` на уровне БД (диапазон — бизнес-правило, а не только C#-валидация).
- CreatedAt: колонку не трогал (осталась `timestamp without time zone` под отчёты DBA). Добавил `ValueConverter<DateTime,DateTime>`: при записи требует `Kind=Utc` и снимает метку (Unspecified) перед отправкой в Npgsql (иначе Npgsql 6+ бросает исключение на "timestamp without time zone" с Kind=Utc); при чтении принудительно проставляет `Kind=Utc`, чтобы код никогда не получал Local/Unspecified независимо от таймзоны клиента.
- Order -> Items и Order -> Payments сконфигурированы явно (`HasMany().WithOne().HasForeignKey(...)`) с `OnDelete(DeleteBehavior.Restrict)`: раз удаление Order — мягкое (IsDeleted), конвенционный Cascade опасен (случайное физическое удаление Order молча снесло бы Items/Payments); Restrict превращает это в явную ошибку FK.
- OrderRepository.ClearItems(Guid orderId): грузит Order с `Include(o => o.Items)`, чистит коллекцию и делает SaveChangesAsync — EF помечает осиротевшие OrderItem на удаление, т.к. FK required (не зависит от Restrict, который относится только к удалению самого Order).
