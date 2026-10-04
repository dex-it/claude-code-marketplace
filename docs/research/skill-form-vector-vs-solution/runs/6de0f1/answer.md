Ревью завершено, результат записан в `_answer.md`. Основные находки:

**1. `Services/CustomerOrders.cs` — `ActivePageAsync` — off-by-one в пагинации (critical)**
`Skip(page * pageSize)` при нумерации страниц с 1 пропускает всю первую страницу и сдвигает все последующие. Должно быть `Skip((page - 1) * pageSize)`.

**2. `Services/CustomerOrders.cs` — `ActivePageAsync` — несовпадение регистра статуса (critical)**
Фильтр `o.Status == "Active"` не совпадает с доменным дефолтом `Status = "active"` в `Model.cs`; Postgres сравнивает строки регистрозависимо — метод рискует всегда возвращать пустые страницы.

**3. `Services/CustomerOrders.cs` — `ActivePageAsync` — нестабильная сортировка для Skip/Take (medium)**
Сортировка только по `CreatedAt` без тай-брейкера — при совпадающих таймстампах возможны дубликаты/пропуски строк между страницами. Нужен вторичный ключ, например `.ThenByDescending(o => o.Id)`.

**4. `Workers/AuditWriter.cs` — риск времени жизни `DbContext` в воркере (high)**
`ShopDbContext` внедряется напрямую в класс из `Workers/`, вызываемый на каждое действие оператора — классический риск захвата scoped-контекста долгоживущим воркером (не потокобезопасно, накопление ChangeTracker). DI-регистрация не входит в дифф — нужно явно проверить composition root либо перейти на `IDbContextFactory<ShopDbContext>`.

**5. `Services/OrderCard.cs` — `GetAsync` — DTO отдаёт сущности целиком (low)**
`OrderCardDto` содержит `IReadOnlyList<OrderItem>`/`IReadOnlyList<Payment>` вместо проекции под карточку — протекание модели данных в контракт.

Без замечаний: `Services/CartLookup.cs` (корректный `Contains`→`ANY`, проекция, `AsNoTracking`), и комбинация `Include` двух коллекций + `AsSplitQuery()` в `OrderCard` — это штатное решение, не баг.