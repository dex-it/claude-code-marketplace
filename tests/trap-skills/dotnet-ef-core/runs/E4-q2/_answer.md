Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E4-X2/Model.cs
- /Users/anonymous/.cache/review/pr280/runs2/E4-X2/OrderRepository.cs

Решения:
- Complexity (int, 1..5) добавлен на Order; в OnModelCreating - IsRequired + HasDefaultValue(3) (безопасный бэкафилл существующих строк) и CHECK-constraint `CK_Order_Complexity_Range` ("Complexity" BETWEEN 1 AND 5) вместо enum/доп. таблицы, т.к. это просто ограниченное целое.
- CreatedAt: колонка timestamp without time zone не тронута (HasColumnType сохранён), поверх добавлен ValueConverter<DateTime,DateTime> - при записи приводит значение к UTC (на случай не-UTC DateTime), при чтении простановляет Kind=Utc, т.к. Npgsql для "without time zone" отдаёт Unspecified. Конвертер действует и на параметры запросов, и на материализацию.
- Order -> Items / Order -> Payments явно сконфигурированы через HasMany().WithOne().HasForeignKey().OnDelete(Cascade): FK обязательные, поэтому Cascade - только про физическое удаление в БД (ON DELETE CASCADE); при мягком удалении (IsDeleted) сироты не удаляются автоматически - у OrderItem/Payment своего query filter нет, чистка - забота приложения (см. ClearItemsAsync).
- OrderRepository.ClearItemsAsync(Guid orderId): выбирает OrderItem напрямую по OrderId (без подгрузки Order/graph), RemoveRange + SaveChangesAsync - т.к. FK обязательный, EF удаляет строки, а не отвязывает их. Метод назван с суффиксом Async, следуя стилю остальных методов репозитория (GetAllAsync/GetAsync).
