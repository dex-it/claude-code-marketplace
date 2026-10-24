Ревью завершено, полный список также сохранён в `work/_answer.md`.

## Critical
1. **Migrations/20260920_OrderCategories.cs → `Up`** — дропает колонку `Orders.Category`, но `Model.cs` (не тронут MR) и `OrderAdmin.UpdateOrder` продолжают читать/писать `Order.Category` как обычное свойство — приложение падает на любом запросе к `Orders` после миграции.
2. **Migrations/20260920_OrderCategories.cs → `Up`** — колонка дропается без переноса существующих значений в `Categories`/`OrderCategories`: безвозвратная потеря исторических категорий заказов.
3. **Services/CatalogService.cs → `Reserve`** — `SELECT ... FOR UPDATE` выполняется без явной транзакции, охватывающей и последующий `SaveChangesAsync`; блокировка снимается сразу после SELECT — гонка, возможна перепродажа остатка.
4. **Workers/OverdueNotifier.cs** — Scoped `ShopDbContext` внедрён напрямую в Singleton `BackgroundService`; нарушение времени жизни DbContext, риск ошибки валидации DI-скоупов при старте и/или бесконтрольный рост change tracker на весь срок жизни приложения.

## High
5. **CatalogService.cs → `Search`** — таблице задан алиас `p`, но условия ссылаются на `"Products"` — гарантированная ошибка Postgres при использовании фильтров.
6. **CatalogService.cs → `Reprice`** — `UpdateRange` на уже отслеживаемых сущностях помечает все поля Modified, включая `Stock`, который может параллельно меняться в `Reserve` — lost update.
7. **OrderQueries.cs → `ExportForCustomer`** — Include двух коллекций (`Items`+`Payments`) без `AsSplitQuery`, декартово произведение для клиентов «с тысячами заказов» (соседний `GetCard` уже использует split query).
8. **OrderQueries.cs → `GetProductBySku`** — `SingleAsync` по `Sku`, который по домену не уникален (один SKU на нескольких складах) — падает на многоскладских товарах.
9. **OrderQueries.cs → `LastShippedAt`** — `last!.Value` после `MaxAsync` по nullable без проверки на null — падает, если у клиента нет отгруженных заказов.
10. **OrderAdmin.cs → `RecalcTotal`** — сумма считается как `Sum(price)` без умножения на `Qty` — бизнес-ошибка в расчёте суммы заказа.

## Medium
11. **OrderAdmin.cs → `UpdateOrder`** — нет защиты от конкурентной правки (concurrency token/обработка конфликтов), хотя MR прямо описывает одновременную правку несколькими операторами.
12. **OrderAdmin.cs → `OverdueReport`** — через репозиторий материализуется вся таблица `Orders` (с трекингом), фильтр по просрочке применяется уже в памяти вместо SQL; рядом в `OverdueNotifier` тот же фильтр уже сделан правильно транслируемым запросом.