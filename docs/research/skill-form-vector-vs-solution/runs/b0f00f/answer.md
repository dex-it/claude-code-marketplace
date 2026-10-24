Провёл ревью 4 изменённых файлов MR !4210. Основные находки:

1. **`Services/CustomerOrders.cs` (`ActivePageAsync`) — critical**: off-by-one в пагинации — `Skip(page * pageSize)` вместо `Skip((page - 1) * pageSize)` при нумерации страниц с 1; первая страница теряется, все страницы сдвинуты.
2. **`Services/CustomerOrders.cs` (`ActivePageAsync`) — high**: фильтр `Status == "Active"` (регистр) не совпадает с доменным дефолтом `"active"` в `Model.cs` — рискует вернуть пустой список активных заказов.
3. **`Workers/AuditWriter.cs` (`WriteAsync`) — critical**: `DateTime.UtcNow` пишется в поле, маппящееся по умолчанию на `timestamp without time zone` (Npgsql 8) — Npgsql бросит исключение из-за `Kind=Utc`, аудит будет падать на каждом вызове.
4. **`Workers/AuditWriter.cs` (класс) — medium**: `ShopDbContext` внедрён напрямую в класс из `Workers/`, без `IServiceScopeFactory` — риск нарушения времени жизни `DbContext` при использовании в фоновом/singleton-сервисе (нужно подтвердить регистрацию в DI).
5. **`Services/OrderCard.cs` (`GetAsync`) — medium**: `AsSplitQuery()` применён к выборке одной сущности по PK — лишние round-trip'ы и риск рассинхронизации данных между тремя запросами без выигрыша, т.к. коллекции одного заказа обычно малы.

Полный текст с обоснованиями и разделом "что проверено и не вызывает вопросов" записан в `/Users/anonymous/.cache/research/runs/b0f00f/work/_answer.md`.