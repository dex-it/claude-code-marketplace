Провёл ревью MR !4127, результат записан в `/Users/anonymous/.cache/research/runs/d0ea5d/work/_answer.md`. Ниже — тот же список.

## Migrations / модель

**1. Migrations/20260920_OrderCategories.cs (Up) + Model.cs (Order.Category) + Services/OrderAdmin.cs (UpdateOrder) — critical**
Миграция дропает `Orders.Category`, но `Model.cs` не менялся: `Order.Category` по-прежнему замаплен на эту колонку, и навигаций к новым `Categories`/`OrderCategories` нет. После деплоя любой запрос, материализующий `Order` (включая `OrderAdmin.UpdateOrder`, который пишет `order.Category = ...`), упадёт с `column "Category" does not exist`.

**2. Migrations/20260920_OrderCategories.cs (Up) — critical**
Нет переноса существующих значений `Orders.Category` в новые таблицы — исторические данные о категориях заказов теряются безвозвратно.

## OrderQueries.cs

**3. ExportForCustomer — high.** `Include(Items).Include(Payments)` без `AsSplitQuery()` — декартово произведение строк, критично при тысячах заказов у клиента.

**4. GetCard — medium.** Наоборот, `AsSplitQuery()` применён к выборке одного заказа по Id — лишние round-trip'ы без общей транзакции; при конкурентной правке заказа операторами карточка может собраться из несогласованных снимков.

**5. GetProductBySku — high.** `SingleAsync(p => p.Sku == sku)`, хотя по модели SKU уникален только в пределах склада, а не глобально — упадёт для любого SKU на нескольких складах (штатная ситуация).

**6. LastShippedAt — high.** `MaxAsync(o => o.ShippedAt)` может вернуть `null` (нет заказов / ничего не отгружено), а `last!.Value` в этом случае бросит `NullReferenceException`.

## OrderAdmin.cs

**7. UpdateOrder — high.** Нет optimistic concurrency (RowVersion/ConcurrencyCheck), хотя в MR явно описан сценарий одновременной правки заказа несколькими операторами — lost update.

**8. RecalcTotal — critical.** `Sum(prices[i.ProductId])` без умножения на `i.Qty` — сумма заказа занижена для любой позиции с количеством > 1. Финансовая ошибка.

**9. OverdueReport (+ OrderRepository.GetAllAsync) — high.** Загружает всю таблицу Orders через репозиторий и фильтрует `IsOverdue()` в памяти, хотя условие полностью транслируемо в SQL (как корректно сделано в OverdueNotifier).

## CatalogService.cs

**10. Reserve — critical.** `SELECT ... FOR UPDATE` через `FromSqlRaw` выполняется вне явной транзакции — блокировка снимается сразу после SELECT, до записи нового `Stock`. Гонка при параллельных резервах → овербукинг/отрицательный остаток.

**11. Search — critical.** Таблице присвоен алиас `p` (`FROM "Products" p`), но условия ссылаются на `"Products"."Category"`/`"Products"."Price"` — PostgreSQL это запрещает после присвоения алиаса, запрос падает при любом реальном фильтре. (Инъекции нет — параметры через `NpgsqlParameter` корректны.)

**12. Reprice — high.** Сущности уже отслеживаются (обычный `ToListAsync()`), но дополнительно вызывается `UpdateRange`, форсируя `Modified` для всех колонок → full-column UPDATE может затереть конкурентно изменённый `Stock` (например, из `Reserve`) устаревшим значением.

## OverdueNotifier.cs / Program.cs

**13. Время жизни DbContext в BackgroundService — critical.** Scoped `ShopDbContext` внедрён напрямую в конструктор singleton `BackgroundService`. При включённой валидации скоупов приложение падает на старте; иначе — один и тот же контекст живёт весь процесс, ChangeTracker бесконечно копит добавленные `AuditLog`. Нужно внедрять `IServiceScopeFactory` и создавать scope на каждой итерации.

**Вывод:** мержить в текущем виде не стоит — пункты 1, 2, 8, 10, 11, 13 либо ломают приложение после деплоя миграции, либо дают неверные финансовые/остаточные данные.