Провёл ревью изменённых файлов MR (`Services/OrderCard.cs`, `Services/CartLookup.cs`, `Services/CustomerOrders.cs`, `Workers/AuditWriter.cs`) по чек-листу EF Core. Ответ записан в `_answer.md`.

**Находки:**

1. **`Services/CustomerOrders.cs` — `ActivePageAsync`** (critical): `Skip(page * pageSize)` вместо `Skip((page - 1) * pageSize)` при страницах с 1 — первая страница (самые свежие заказы) никогда не отдаётся, все страницы сдвинуты на одну.

2. **`Services/CustomerOrders.cs` — `ActivePageAsync`** (critical): фильтр `o.Status == "Active"`, а в `Model.cs` статус по умолчанию `"active"` (регистр другой). Postgres сравнивает строки регистрозависимо — метод в типичном случае вернёт пустой список.

3. **`Workers/AuditWriter.cs` — `WriteAsync`** (medium): класс в каталоге `Workers` наводит на мысль об использовании в `BackgroundService` (singleton), тогда как `ShopDbContext` — scoped. Нужно убедиться, что контекст резолвится per-scope на каждую операцию, а не захватывается singleton-воркером.

4. **`Services/OrderCard.cs` — `GetAsync`** (low): `Include(o => o.Customer)` тянет всю сущность ради одного поля `Name` — лучше проецировать явно.

Отдельно отметил в ответе, что сплит-квери для двух коллекций, `AsNoTracking`, `Contains` на тысячах id и использование `Add` вместо `AddAsync` в этом MR сделаны корректно.