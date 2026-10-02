Готово. Список изменённых/созданных файлов:

- **OrderRepository.cs** — добавлен метод `Query()` (`IQueryable<Order>` c `AsNoTracking()`) для композиции read-only запросов, существующие методы не тронуты.
- **OrderReportService.cs** (новый) — три метода: `GetActiveOrdersAsync` (проекция Id/имя клиента/Total/число позиций), `GetActiveOrderCountByCategoryAsync` (GroupBy+Count транслируется в SQL, возвращает `Dictionary<string,int>`), `GetOverdueOrdersAsync(now)` (условие просрочки).
- **_answer.md** — тот же отчёт записан в файл.

Решения: все методы работают через `IQueryable`-проекции поверх `OrderRepository.Query()`, чтобы фильтрация/группировка/подсчёт считались в БД, а не в памяти; правило `Order.IsOverdue` продублировано инлайн-выражением (`ShippedAt == null && CreatedAt.AddDays(3) < now`), так как вызов метода экземпляра сущности не транслируется EF Core в SQL.