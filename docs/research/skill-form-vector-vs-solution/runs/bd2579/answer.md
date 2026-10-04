Провёл ревью MR !4127, нашёл 12 дефектов (5 critical, 6 high, 2 medium — записано в `_answer.md`). Ключевые:

**Critical**
1. **Migrations/20260920_OrderCategories.cs** — дропает `Orders.Category`, но `Model.cs` не обновлён и данные не перенесены в новые `Categories`/`OrderCategories` — ломает все запросы к заказам и теряет историю категорий.
2. **OrderAdmin.RecalcTotal** — сумма считается без умножения на `OrderItem.Qty`, занижает `Total`.
3. **CatalogService.Search** — в SQL таблице задан алиас `p`, а условия фильтра обращаются к ней по имени `"Products"` — Postgres упадёт с ошибкой на любом непустом фильтре.
4. **CatalogService.Reserve** — `SELECT ... FOR UPDATE` не обёрнут в явную транзакцию с последующим `SaveChangesAsync`, блокировка снимается раньше апдейта — race condition, overselling остатков.
5. **Workers/OverdueNotifier** — Scoped `ShopDbContext` внедрён напрямую в singleton `BackgroundService`.

**High**
6. `OrderQueries.GetProductBySku` — `SingleAsync` по SKU, который уникален только в рамках склада, а не глобально.
7. `OrderQueries.LastShippedAt` — `last!.Value` падает NRE, если у клиента нет отгруженных заказов.
8. `OrderQueries.ExportForCustomer` — два `Include`-коллекции без `AsSplitQuery` → декартово произведение при тысячах заказов.
9. `OrderAdmin.UpdateOrder` — нет concurrency-контроля при заявленном параллельном редактировании операторами → lost update.
10. `OrderAdmin.OverdueReport` — грузит всю таблицу `Orders` в память и фильтрует на клиенте вместо `Where` на уровне SQL.

**Medium**
11. `CatalogService.Reprice` — `UpdateRange` на уже отслеживаемых сущностях перезаписывает все колонки, включая `Stock`, рискуя затереть конкурентные изменения от `Reserve`.
12. `OverdueNotifier.ExecuteAsync` — нет try/catch в цикле, любое исключение останавливает воркер насовсем.

Полный текст с объяснениями и кодом записан в `/Users/anonymous/.cache/research/runs/bd2579/work/_answer.md`.