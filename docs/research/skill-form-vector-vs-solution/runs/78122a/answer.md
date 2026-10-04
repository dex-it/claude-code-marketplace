Провёл ревью изменённых файлов MR !4210 (`OrderCard.cs`, `CartLookup.cs`, `CustomerOrders.cs`, `AuditWriter.cs`) против чек-листа EF Core. Результат записан в `_answer.md`. Основные находки:

1. **`CustomerOrders.ActivePageAsync`** — фильтр `Status == "Active"` не совпадает с доменным значением `"active"` (регистрозависимое сравнение в Postgres) → метод всегда возвращает пустую страницу. **critical**
2. **`CustomerOrders.ActivePageAsync`** — `Skip(page * pageSize)` при пагинации с 1 вместо `Skip((page-1)*pageSize)` — off-by-one, первая страница недоступна, остальные смещены. **high**
3. **`CustomerOrders.ActivePageAsync`** — сортировка только по `CreatedAt` без уникального тай-брейкера при `Skip/Take` — нестабильная пагинация при совпадающих timestamp. **medium**
4. **`OrderCard.GetAsync`** — `AsSplitQuery` с несколькими round-trip'ами без общей транзакции/снапшота — риск несогласованных данных карточки между запросами Items/Payments. **low**
5. **`AuditWriter`** — прямое внедрение `ShopDbContext` в класс из `Workers/` — риск захвата scoped-контекста в singleton-хостed-сервисе; нужно подтвердить регистрацию в DI. **medium**

Также отметил, что часть кода сделана правильно (проекции вместо полных сущностей в `CartLookup`, `AsNoTracking`, `Add` вместо `AddAsync`, корректный `Kind`/тип колонки для `AuditLog.At`).