## Изменённые/созданные файлы

- `Model.cs` — добавлены `Category`, `OrderCategory`, `Order.OrderCategories`, DbSet'ы и конфигурация связей в `OnModelCreating`. `Order.Category` пока оставлен.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — схема: таблицы `Categories`, `OrderCategories`, индексы, FK.
- `Migrations/20260929120100_BackfillOrderCategories.cs` — отдельная миграция данных: SQL-бэкфилл `Orders.Category` → `Categories`/`OrderCategories`.
- `.github/workflows/deploy-migrations.yml` — ручной шаг деплоя на prod с environment-гейтом, идемпотентным скриптом и применением через `psql`.

## Решения (кратко)

Схема и бэкфилл данных разнесены на две миграции (сохраняется откатываемость схемы отдельно от данных), бэкфилл — набором SQL-запросов, а не циклом `SaveChanges`. Прод-деплой — только по ручному триггеру с GitHub Environment `production` (approval-гейт) и идемпотентным скриптом для безопасного повтора.

Важно: в каталоге нет `.csproj`/существующих миграций/`ModelSnapshot.cs`, поэтому `dotnet ef migrations add` запустить было негде (и сборку запускать запрещалось условием) — файлы миграций написаны вручную в формате EF Core, но `*.Designer.cs`/`ModelSnapshot.cs` нужно будет сгенерировать инструментом `dotnet ef` в реальном проекте. Тот же текст сохранён в `work/_answer.md`.