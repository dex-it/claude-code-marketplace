## Ревью MR !4127

### Critical
1. **CatalogService.Search** — условия `FromSqlRaw` ссылаются на `"Products".Col`, а таблице в запросе присвоен алиас `p` → PostgreSQL падает с ошибкой при любом заданном фильтре, поиск фактически неработоспособен.
2. **CatalogService.Reserve** — `FOR UPDATE` и последующий `SaveChangesAsync` не в одной явной транзакции, блокировка строки снимается сразу после `SELECT` → гонка на `Stock`, возможен overselling.
3. **OrderQueries.GetProductBySku** — `SingleAsync` по `Sku`, хотя SKU уникален только в пределах склада → падает для обычных многосклад­ных товаров.
4. **OrderAdmin.RecalcTotal** — сумма считается как `Sum(price)` без учёта `Qty` → неверный итог заказа (бизнес-баг).
5. **OrderAdmin.OverdueReport / OrderRepository.GetAllAsync** — грузит всю таблицу Orders в память и фильтрует в LINQ-to-Objects после материализации; рядом же в OverdueNotifier та же задача сделана правильно (фильтр в IQueryable).
6. **Workers/OverdueNotifier** — scoped `ShopDbContext` инжектится в конструктор singleton-`BackgroundService`; либо падение при старте, либо один и тот же контекст живёт весь процесс (утечка ChangeTracker, не потокобезопасно).
7. **Migrations/20260920_OrderCategories.Up** — `DropColumn("Category", "Orders")` без переноса существующих значений в `Categories`/`OrderCategories` → потеря исторических данных.

### High
8. **CatalogService.Reprice** — лишний `UpdateRange` на уже отслеживаемых сущностях помечает все поля Modified, рискует затереть конкурентно изменённый `Stock`.
9. **OrderQueries.ExportForCustomer** — два `Include` коллекций без `AsSplitQuery()` → декартово произведение, критично при тысячах заказов у клиента.
10. **OrderQueries.LastShippedAt** — `last!.Value` без проверки на null при `MaxAsync` по nullable-полю → падает для клиентов без отгруженных заказов.
11. **OrderAdmin.UpdateOrder** — нет optimistic concurrency при параллельной правке заказа несколькими операторами → молчаливый lost update.

Полный текст с обоснованиями записан в `/Users/anonymous/.cache/research/runs/e48f32/work/_answer.md`.