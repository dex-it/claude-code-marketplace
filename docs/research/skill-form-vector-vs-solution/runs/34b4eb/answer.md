Провёл ревью 4 изменённых файлов MR. Основные находки:

**1. Workers/AuditWriter.cs — `WriteAsync` — critical**
`At = DateTime.UtcNow` (Kind=Utc) пишется в колонку без явного `HasColumnType`, а провайдер Npgsql по умолчанию маппит `DateTime` на `timestamp without time zone` (как явно указано для `Order.CreatedAt` в том же контексте). Npgsql/EFCore.PG 6.0+ запрещает запись значения с `Kind=Utc` в такую колонку — `SaveChangesAsync` бросит исключение при каждом вызове. Аудит-запись полностью не работает.

**2. Services/CustomerOrders.cs — `ActivePageAsync` — off-by-one пагинации — high**
Комментарий и MR.md говорят «страницы с 1», но `Skip(page * pageSize)` при `page=1` пропускает первую страницу целиком — должно быть `Skip((page - 1) * pageSize)`.

**3. Services/CustomerOrders.cs — `ActivePageAsync` — регистр статуса — high**
Фильтр `o.Status == "Active"`, а `Order.Status` в модели по умолчанию `"active"` (строчными). Сравнение строк в Postgres регистрозависимое — метод рискует всегда возвращать пустой список.

**4. Services/OrderCard.cs — `GetAsync` — `AsSplitQuery()` на single-entity запросе — medium**
Ровно анти-паттерн из командного чек-листа: `SingleOrDefaultAsync` по одному `Id` со сплит-запросом добавляет лишние roundtrip'ы, которые для одной записи обычно дороже, чем небольшой cartesian `Items × Payments`.

Также отметил (не как отдельный дефект, а как вопрос на ревью) — `AuditWriter` лежит в `Workers`, что намекает на `BackgroundService`; DI-файлов в диффе нет, стоит проверить lifetime `ShopDbContext` там.

Полный текст сохранён в `_answer.md`.