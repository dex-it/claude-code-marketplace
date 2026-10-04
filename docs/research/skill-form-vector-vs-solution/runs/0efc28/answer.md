Ревью проведено, найдено 13 дефектов (6 critical, 4 high, 1 medium, 2 low). Ключевые блокеры перед мерджем:

- **Миграция дропает `Orders.Category` без переноса данных**, а `Order.Category`/`OrderAdmin.UpdateOrder` всё ещё её используют — приложение либо упадёт, либо тихо потеряет категории.
- **`RecalcTotal` не умножает цену на `Qty`** — итог заказа считается неверно.
- **`CatalogService.Reserve`**: `FOR UPDATE` без транзакции — блокировка не работает, гонка при резервировании остатка.
- **`CatalogService.Search`**: рассинхрон алиасов в `FromSqlRaw` — упадёт при любом фильтре.
- **`GetProductBySku`**: `SingleAsync` по SKU, который не уникален (уникален только в рамках склада).
- **`OverdueNotifier`**: scoped `ShopDbContext` заинжектен напрямую в singleton `BackgroundService`.

Полный список с обоснованиями и severity записан в `/Users/anonymous/.cache/research/runs/0efc28/work/_answer.md`.