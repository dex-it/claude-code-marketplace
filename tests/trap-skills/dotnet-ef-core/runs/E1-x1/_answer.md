Изменённые/созданные файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E1-X1/OrderRepository.cs — добавлен метод `QueryAsNoTracking()`, отдающий `IQueryable<Order>` без трекинга (soft-delete фильтр `HasQueryFilter` продолжает применяться автоматически).
- /Users/anonymous/.cache/review/pr280/runs2/E1-X1/OrderReportService.cs (новый) — сервис `OrderReportService` с методами `GetActiveOrdersAsync()` (a), `GetActiveOrderCountByCategoryAsync()` (b) и `GetOverdueOrdersAsync(DateTime now)` (c), поверх `OrderRepository.QueryAsNoTracking()`.

Решения:
- Все три запроса читают через `AsNoTracking()`-источник и проецируются сразу в `record OrderReportRow` (Id, имя клиента, Total, число позиций через `o.Items.Count` — коррелированный подзапрос, без подгрузки всей коллекции) — без трекинга и без лишних Include/lazy-loading.
- Условие `IsOverdue` не вызывается как метод сущности (нетранслируемо), а инлайнено: `o.ShippedAt == null && o.CreatedAt.AddDays(3) < asOf`.
- `CreatedAt` замаплен на `timestamp without time zone`, поэтому перед сравнением `now` приводится к `DateTime.SpecifyKind(now, DateTimeKind.Unspecified)` — иначе Npgsql бросит исключение на параметре с Kind=Utc/Local.
