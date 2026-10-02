Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E4-X1/Model.cs
- /Users/anonymous/.cache/review/pr280/runs2/E4-X1/OrderRepository.cs

Решения:
- Complexity (int, 1..5) добавлен в Order и ограничен CHECK-констрейнтом на таблице (`CK_Order_Complexity_Range`), а не только валидацией в коде.
- CreatedAt: колонка осталась `timestamp without time zone`, но добавлен ValueConverter, который на запись переводит DateTime.UtcNow (Kind=Utc) в Kind=Unspecified (это единственный Kind, который Npgsql 6+ пишет в такую колонку), а на чтении и в параметрах запросов всегда возвращает Kind=Utc — так клиенты в разных таймзонах всегда получают UTC, а отчёты DBA видят те же сырые значения в колонке.
- Order -> Items и Order -> Payments явно сконфигурированы как required FK с `OnDelete(DeleteBehavior.Cascade)` в OnModelCreating (Order мягко удаляется через существующий HasQueryFilter; каскад в БД нужен на случай реального DELETE, например при физической чистке старых soft-deleted заказов).
- ClearItems(Guid orderId) в OrderRepository загружает заказ с Items, чистит коллекцию (required FK => EF Core удаляет осиротевшие OrderItem при SaveChanges) и сохраняет. Заодно существующие read-only методы GetAllAsync/GetAsync переведены на AsNoTracking() по чек-листу команды.
