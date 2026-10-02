Ревью проведено, результат записан в `_answer.md`. Основные находки:

**1. `Services/CustomerOrders.cs` — `ActivePageAsync`** (high)
Off-by-one: `Skip(page * pageSize)` вместо `Skip((page - 1) * pageSize)` — при нумерации страниц с 1 первая страница пропускается, вся пагинация сдвинута.

**2. `Services/CustomerOrders.cs` — `ActivePageAsync`** (critical)
Фильтр `Status == "Active"` не совпадает по регистру с дефолтным значением домена `"active"` в `Order.Status` — сравнение строк в Postgres регистрозависимое, запрос рискует никогда не находить ни одной строки.

**3. `Services/CustomerOrders.cs` — `ActivePageAsync`** (medium)
Сортировка только по `CreatedAt` без tie-breaker — при `Skip/Take` возможны дубли/пропуски строк с одинаковым `CreatedAt` между запросами.

**4. `Services/OrderCard.cs` — `GetAsync`** (medium)
`Include(o => o.Customer)` тянет всю сущность `Customer` отдельным split-запросом ради единственного поля `Name` — стоит заменить на проекцию.

**5. `Workers/AuditWriter.cs` — `WriteAsync`** (high)
`DateTime.UtcNow` пишется без явного `HasColumnType` для `AuditLog.At`, тогда как в проекте есть конвенция `"timestamp without time zone"` (см. `Order.CreatedAt`) — риск рассинхрона типов дат либо рантайм-исключения Npgsql при записи `Kind=Utc` в `timestamp without time zone`.

**6. `Workers/AuditWriter.cs` — конструктор** (high, требует проверки DI)
Прямое внедрение scoped `ShopDbContext` в класс из `Workers/` — если резолвится как singleton внутри `BackgroundService`, это captive dependency и нарушение правила времени жизни `DbContext`.

Также отметил в ответе, что сделано правильно (AsNoTracking, AsSplitQuery для двух коллекций, `Add` вместо `AddAsync`, безопасный `Contains` для тысяч id через Npgsql `ANY`).