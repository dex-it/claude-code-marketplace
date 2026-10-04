## Изменённые/созданные файлы

- `OrderRepository.cs` — добавлен метод `Query()` (`IQueryable<Order>` с `AsNoTracking()`) для композиции отчётных запросов; существующие методы не тронуты.
- `OrderReportService.cs` (новый) — сервис `OrderReportService` с тремя методами: `GetActiveOrdersAsync()`, `GetActiveOrderCountsByCategoryAsync()`, `GetOverdueOrdersAsync(DateTime now)`.

## Решения

Все запросы строятся через `IQueryable` с проекцией/группировкой до материализации (без ручной фильтрации/агрегации в памяти), фильтр `IsDeleted` уже применяется глобальным `HasQueryFilter`. Условие `IsOverdue` инлайнено в `Where` вместо вызова метода сущности — иначе EF Core не сможет транслировать выражение в SQL. Ответ также записан в `_answer.md`.