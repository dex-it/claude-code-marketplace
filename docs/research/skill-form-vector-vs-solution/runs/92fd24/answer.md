## Итоги ревью MR !4210

**1. `Workers/AuditWriter.cs` — `WriteAsync` (critical)**
`At = DateTime.UtcNow` (Kind=Utc) пишется в колонку без явного `HasColumnType`, которая по конвенции Npgsql/EFCore.PG мапится в `timestamp without time zone` (по аналогии с явно сконфигурированным `Order.CreatedAt` в том же контексте). Npgsql 6+ бросает исключение при записи `Kind=Utc` в `timestamp` — каждый вызов аудита будет падать в рантайме.

**2. `Services/CustomerOrders.cs` — `ActivePageAsync` (high)**
`Skip(page * pageSize)` при нумерации страниц с 1 (как заявлено в комментарии и MR) — классический off-by-one: страница 1 отдаёт данные страницы 2, первая страница результатов никогда не возвращается. Нужно `Skip((page - 1) * pageSize)`.

**3. `Workers/AuditWriter.cs` — DbContext lifetime (medium, требует подтверждения)**
Класс лежит в `Workers/` и напрямую инжектирует Scoped `ShopDbContext`; в диффе не видно, как он резолвится. Если используется из `BackgroundService`/hosted service без `IServiceScopeFactory`, это классический Scoped-в-Singleton анти-паттерн.

**4. `Services/CustomerOrders.cs` — нестабильная сортировка (low)**
`OrderByDescending(o => o.CreatedAt)` без tie-breaker (например, `Id`) — при совпадающих timestamp'ах пагинация может дублировать/терять строки между страницами.

Остальное (`AsSplitQuery` в `OrderCard`, `Contains` на тысячах id в `CartLookup`, `Add()` вместо `AddAsync()`) проверено и соответствует правилам команды — дефектов не найдено. Полный текст ответа сохранён в `_answer.md`.