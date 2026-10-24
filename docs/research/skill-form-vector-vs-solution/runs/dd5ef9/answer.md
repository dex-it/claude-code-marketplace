## Ревью MR !4210

**1. `Services/CustomerOrders.cs` — `ActivePageAsync`: off-by-one в пагинации.** `Skip(page * pageSize)` при 1-based нумерации страниц (см. комментарий и MR.md) пропускает всю первую страницу — для `page=1` возвращается контент второй страницы. Нужно `(page - 1) * pageSize`.
**Severity: critical**

**2. `Services/CustomerOrders.cs` — `ActivePageAsync`: регистр в фильтре статуса.** Фильтр `o.Status == "Active"`, а дефолт сущности в `Model.cs` — `"active"` (нижний регистр). Postgres-сравнение регистрозависимо; если реальные статусы хранятся в нижнем регистре, список активных заказов клиента всегда будет пустым.
**Severity: high**

**3. `Workers/AuditWriter.cs` — конструктор: прямая инъекция `ShopDbContext`.** Класс лежит в `Workers/`, что указывает на использование из `BackgroundService`. Прямая инъекция scoped `ShopDbContext` в объект с потенциально singleton-временем жизни ведёт либо к ошибке DI-резолва, либо к гонкам/`InvalidOperationException` при конкурентных вызовах `WriteAsync`. Нужен `IServiceScopeFactory`/`IDbContextFactory<ShopDbContext>` со scope на каждый вызов.
**Severity: high**

**4. `Services/OrderCard.cs` — `GetAsync`: `AsSplitQuery()` на выборке одной сущности по уникальному ключу.** Три отдельных нетранзакционных запроса вместо одного дают риск несогласованного снапшота между `Items` и `Payments` при конкурентной записи, и не нужны при малом декартовом произведении для одного заказа.
**Severity: medium**

**5. `Services/OrderCard.cs` — `GetAsync`: полная сущность `Customer` ради одного поля.** `Include(o => o.Customer)` вместо проекции только `Name`, лишний JOIN и прокси-объект.
**Severity: low**

**6. `Services/CustomerOrders.cs` — `ActivePageAsync`: сортировка без стабильного тай-брейкера.** `OrderByDescending(o => o.CreatedAt)` без вторичного ключа (`o.Id`) — риск нестабильной пагинации при совпадающих датах.
**Severity: low**

`CartLookup.cs` нарушений не показал — корректный `AsNoTracking` + проекция + `Distinct()` перед параметризованным `Contains`.

Полный текст ответа записан в `/Users/anonymous/.cache/research/runs/dd5ef9/work/_answer.md`.