## Ревью MR !4210

**1. `Services/CustomerOrders.cs` — `ActivePageAsync` — off-by-one в пагинации.** `Skip(page * pageSize)` при нумерации страниц с 1 пропускает всю первую страницу и сдвигает все остальные на одну; корректно `Skip((page - 1) * pageSize)`. **critical**

**2. `Services/CustomerOrders.cs` — `ActivePageAsync` — регистр в фильтре статуса.** Фильтр `o.Status == "Active"` (с большой буквы) против домена, где `Order.Status` по умолчанию `"active"` (`Model.cs`). PostgreSQL сравнивает строки регистрозависимо — метод будет молча возвращать пустые страницы для всех активных заказов. **critical**

**3. `Workers/AuditWriter.cs` — `WriteAsync` — время жизни `DbContext`.** Класс в `Workers/` (фоновая обработка), но `ShopDbContext` (Scoped по умолчанию) инжектится напрямую в конструктор — типичный антипаттерн Scoped-в-Singleton: либо падение при валидации DI, либо один долгоживущий `DbContext`, не потокобезопасный при параллельных вызовах. Нужно резолвить контекст на вызов через `IServiceScopeFactory`/`IDbContextFactory`. **critical**

**4. `Services/OrderCard.cs` — `GetAsync` — DTO отдаёт полные сущности `OrderItem`/`Payment`** вместо проекции — утечка полей БД в контракт API. **low**

**5. `Services/OrderCard.cs` — `GetAsync` — split query без транзакции** для `Items`/`Payments` двух отдельных round-trip'ов — возможна рассинхронизация данных при параллельной записи (например, оплата пришла между запросами). **low**

Полный текст ответа записан в `/Users/anonymous/.cache/research/runs/b4d1fc/work/_answer.md`. Код не менял, сборку и тесты не запускал.