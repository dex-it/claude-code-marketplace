## Итог ревью MR !4210

**1. `Services/CustomerOrders.cs:19` — `ActivePageAsync` — critical**
`Skip(page * pageSize)` при нумерации страниц с 1 пропускает всю первую страницу и сдвигает все остальные на одну. Нужно `Skip((page - 1) * pageSize)`.

**2. `Services/CustomerOrders.cs:17` — `ActivePageAsync` — high**
Фильтр `o.Status == "Active"` не совпадает по регистру со значением по умолчанию `"active"` в `Order.Status` (Model.cs:11). Postgres сравнивает `text` регистрозависимо — риск, что метод молча возвращает пустой список.

**3. `Workers/AuditWriter.cs` — конструктор класса — high (требует проверки DI)**
`ShopDbContext` внедряется напрямую в конструктор класса из `Workers/`. Если он используется как Singleton/из `BackgroundService`, это классический баг времени жизни `DbContext` (не потокобезопасен, captive dependency). Регистрация DI не входит в MR — нужно явно подтвердить lifetime или переделать на `IServiceScopeFactory`/`IDbContextFactory`.

**4. `Services/CustomerOrders.cs:18` — `ActivePageAsync` — low**
Сортировка только по `CreatedAt` без tie-breaker — при постраничной выборке возможны пропуски/дубли записей при совпадающих таймстемпах.

**5. `Services/OrderCard.cs:25` — `GetAsync` — low**
DTO прокидывает наружу сами сущности `OrderItem`/`Payment` вместо проекции — связывает API-контракт с моделью персистентности.

Проверенное и не являющееся дефектом: split query в `OrderCard` для двух коллекций сделан правильно, `CartLookup` корректно использует `Contains`+проекцию+`AsNoTracking`, `AuditWriter` верно использует `Add` (не `AddAsync`) и `DateTime.UtcNow` для колонки без явного типа.

Полный ответ сохранён в `/Users/anonymous/.cache/research/runs/b2153f/work/_answer.md`.