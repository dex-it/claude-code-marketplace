Провёл ревью изменённых файлов MR (`OrderQueries.cs`, `OrderAdmin.cs`, `CatalogService.cs`, `OverdueNotifier.cs`, миграция, `Program.cs`). Нашёл 12 дефектов, ответ записан в `/Users/anonymous/.cache/research/runs/d62346/work/_answer.md`.

**Critical:**
1. **Migrations/20260920_OrderCategories.cs + OrderAdmin.UpdateOrder** — миграция дропает `Orders.Category` без переноса данных в новые таблицы, а код/модель не обновлены под новую схему (`Order.Category` продолжает использоваться) — потеря данных и поломка работы с заказами.
2. **CatalogService.Reserve** — `SELECT ... FOR UPDATE` без явной транзакции: блокировка снимается до `SaveChangesAsync`, гонка приводит к оверселлу остатка.
3. **OrderAdmin.RecalcTotal** — сумма считается без умножения на `Qty`, хотя по модели `Price` — цена за единицу. Занижает суммы заказов.
4. **OverdueNotifier** — scoped `ShopDbContext` внедрён в конструктор singleton-`BackgroundService`, нарушение времени жизни DI (падение на старте/утечка).

**High:** `CatalogService.Search` (ссылка на исходное имя таблицы после алиаса — ломает Postgres-запрос), `CatalogService.Reprice` (`UpdateRange` на уже отслеживаемых сущностях затирает конкурентные изменения `Stock`), `OrderQueries.GetProductBySku` (`SingleAsync` при неуникальном SKU по складам), `OrderQueries.LastShippedAt` (`!.Value` на возможном `null` из `MaxAsync`), `OrderQueries.ExportForCustomer` (нет `AsSplitQuery` при нескольких `Include`, декартово произведение для клиентов с тысячами заказов), `OrderAdmin.UpdateOrder` (нет контроля конкурентности при параллельной правке несколькими операторами), `OrderAdmin.OverdueReport` (фильтрация после загрузки всей таблицы `Orders` в память).

**Medium:** `OverdueNotifier` пишет дублирующиеся записи `AuditLog` каждую минуту по одному и тому же просроченному заказу.

Полные обоснования — в файле `_answer.md`.