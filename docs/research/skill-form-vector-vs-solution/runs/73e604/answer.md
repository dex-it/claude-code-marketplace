Провёл ревью MR !4127. Основные находки (полный текст также сохранён в `_answer.md`):

## Critical (блокирует мердж)
1. **Migrations/20260920_OrderCategories.cs `Up()` + `Model.cs Order.Category`** — миграция дропает колонку `Category` из `Orders`, но модель (не менялась в MR) всё ещё маппит это свойство → любое обращение к `Orders` после наката упадёт («column does not exist»).
2. **Migrations/20260920_OrderCategories.cs `Up()`** — нет data-migration существующих значений `Orders.Category` в `Categories`/`OrderCategories` перед дропом колонки — исторические данные теряются безвозвратно.
3. **CatalogService.Reserve()** — `FOR UPDATE` без явной транзакции; блокировка снимается сразу после SELECT → race condition, оверселлинг остатка при параллельных резервах.
4. **CatalogService.Search()** — в динамическом `FromSqlRaw` таблица заалиасена как `p`, а условия ссылаются на `"Products".Column` вместо `p.Column` → PostgreSQL упадёт с «invalid reference to FROM-clause entry» при любом непустом фильтре.
5. **OrderAdmin.RecalcTotal()** — сумма считается как `Sum(prices[ProductId])`, без умножения на `Qty` — неверный расчёт итога заказа для любого количества ≠ 1.
6. **OrderQueries.GetProductBySku()** — `SingleAsync` по SKU, хотя по модели SKU не уникален глобально (лежит на нескольких складах) → гарантированный `InvalidOperationException`.
7. **Workers/OverdueNotifier** — scoped `ShopDbContext` инжектится напрямую в `BackgroundService` (singleton) вместо `IServiceScopeFactory` — классический lifetime-баг.

## High
8. **OrderQueries.ExportForCustomer()** — два `Include` без `AsSplitQuery` → cartesian explosion, а MR явно говорит про клиентов с тысячами заказов.
9. **OrderAdmin.OverdueReport()** — грузит ВСЕ заказы через `_repo.GetAllAsync()` и фильтрует просрочку в памяти вместо SQL.
10. **OrderAdmin.UpdateOrder()** — нет concurrency-токена, хотя MR явно описывает конкурентное редактирование несколькими операторами (last write wins).

## Medium / Low
11. `LastShippedAt()` — `last!.Value` упадёт с NRE, если у клиента нет отгрузок.
12. `RecalcTotal()` — `KeyNotFoundException`, если товар из позиции отсутствует в `Products`.
13. `CatalogService.Reprice()` — лишний/опасный `UpdateRange` на уже tracked-сущностях (перезаписывает все колонки); лучше `ExecuteUpdateAsync`.
14. `OverdueNotifier` — нет try/catch, единичная ошибка навсегда останавливает воркер.
15. `GetCard()` — `AsSplitQuery` избыточен для one-entity запроса (низкий приоритет).