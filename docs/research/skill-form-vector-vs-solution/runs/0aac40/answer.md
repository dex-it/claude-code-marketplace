Ревью завершено, результат также сохранён в `_answer.md`.

## Критичные дефекты

1. **Migrations/20260920_OrderCategories.cs ↔ Model.cs / OrderAdmin.UpdateOrder** — миграция дропает `Orders.Category`, но модель EF не обновлена: `Order.Category` остаётся скалярным свойством, `OrderAdmin.UpdateOrder` пишет в него. После деплоя миграции упадёт **любой** запрос к `Orders`. Новые таблицы `Categories`/`OrderCategories` недостижимы из кода, данных о категориях историческая миграция не переносит — потеря данных.
2. **OrderAdmin.RecalcTotal** — сумма заказа считается без умножения на `Qty` (`prices[i.ProductId]` вместо `i.Qty * prices[i.ProductId]`) — неверный итог заказа.
3. **OrderAdmin.OverdueReport** — `GetAllAsync()` тянет всю таблицу `Orders` в память, фильтр `IsOverdue` применяется после материализации — классический антипаттерн «фильтр после ToList».
4. **CatalogService.Reserve** — `FOR UPDATE` без явной транзакции: блокировка снимается сразу после `SELECT`, до `SaveChangesAsync` — гонка позволяет оверселл остатка.
5. **OverdueNotifier(ShopDbContext db)** — Scoped `DbContext` инжектирован в `BackgroundService`, зарегистрированный как singleton — классический Scoped-in-Singleton баг.
6. **OverdueNotifier.ExecuteAsync** — `AuditLog.At = DateTime.UtcNow` (Kind=Utc) пишется в колонку, маппящуюся по умолчанию на `timestamp without time zone` — Npgsql 6+ бросит исключение при `SaveChangesAsync`.

## High

7. **OrderQueries.ExportForCustomer** — два `Include` без `AsSplitQuery` для клиентов с тысячами заказов — cartesian explosion.
8. **OrderQueries.GetProductBySku** — `SingleAsync` по `Sku`, хотя SKU уникален только в пределах склада — упадёт при наличии SKU на нескольких складах.
9. **OrderQueries.LastShippedAt** — `MaxAsync(ShippedAt)` без фильтра `!= null`, затем `last!.Value` — NRE, если у клиента нет отгрузок.
10. **OrderAdmin.UpdateOrder/RecalcTotal** — нет ConcurrencyToken при явно заявленном параллельном редактировании операторами — lost update.
11. **CatalogService.Search** — алиас `p` в шаблоне, но условия используют `"Products".col` — runtime-ошибка Postgres при любом фильтре.

## Medium

12. **CatalogService.Reprice** — `UpdateRange` на уже tracked-сущностях + цикл вместо `ExecuteUpdateAsync`.

## Low

13. **OrderQueries.GetCard** — `AsSplitQuery` для выборки одной сущности по Id — лишний round-trip.