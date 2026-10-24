## Итоги ревью MR !4127

Нашёл 13 дефектов (6 critical, 4 high, 2 medium, 1 low), полный список с обоснованиями записан в `/Users/anonymous/.cache/research/runs/67761e/work/_answer.md`. Ключевые:

**Critical:**
1. `OverdueNotifier` — scoped `ShopDbContext` захватывается в singleton `BackgroundService`, живёт вечно, Change Tracker течёт.
2. `CatalogService.Reserve` — `FOR UPDATE` без обёртывающей транзакции, блокировка снимается до `SaveChangesAsync` → гонка при резервировании остатка.
3. `CatalogService.Search` — несовпадение алиаса таблицы (`p` в шаблоне vs `"Products"` в условиях) → SQL-ошибка при любом фильтре.
4. Миграция `20260920_OrderCategories` дропает `Orders.Category` без переноса данных в новые таблицы, а модель/`OrderAdmin.UpdateOrder` не обновлены — приложение сломается после наката.
5. `OrderQueries.GetProductBySku` — `SingleAsync` по `Sku`, который по домену не уникален (один SKU на нескольких складах).
6. `OrderAdmin.RecalcTotal` — сумма считается без умножения на `Qty`, итог заказа неверен.

**High:** `LastShippedAt` (`!` на nullable без проверки), `ExportForCustomer` (два Include-коллекции без `AsSplitQuery` при "тысячах заказов"), `OverdueReport` (полная материализация таблицы с трекингом перед фильтрацией), отсутствие защиты от конкурентной правки в `OrderAdmin`.

**Medium/Low:** избыточный `UpdateRange` на уже трекаемых сущностях в `Reprice`, потеря данных также в `Down()`-миграции, дублирующиеся записи `AuditLog` каждую минуту в `OverdueNotifier`.