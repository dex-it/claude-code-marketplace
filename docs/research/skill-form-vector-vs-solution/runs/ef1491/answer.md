## Созданные/изменённые файлы

- `Model.cs` — изменён: добавлены `Category`, `OrderCategory` (composite key), навигация `Order.OrderCategories`, `DbSet`'ы и конфигурация связей/уникального индекса в `OnModelCreating`; `Order.Category` пока оставлена.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — создание таблиц `Categories`/`OrderCategories` с FK и уникальным индексом.
- `Migrations/20260929120001_BackfillOrderCategories.cs` — data-миграция: переносит уникальные значения `Orders.Category` в `Categories` и создаёт связи, не трогая старую колонку.
- `.github/workflows/deploy-migrations.yml` — новый workflow: собирает self-contained EF Core migration bundle и применяет его к production через `secrets.PROD_DB_CONNECTION_STRING`, за gate'ом environment `production`.
- `_answer.md` — тот же ответ.

## Решения

Использован паттерн expand-contract (сначала новые таблицы + бэкфилл, удаление `Order.Category` — отдельной будущей миграцией). Для продакшен-деплоя выбран `dotnet ef migrations bundle` — самодостаточный бинарь без SDK на проде, идемпотентно применяет только неприменённые миграции. В каталоге не было `.csproj`/истории миграций, поэтому `Designer.cs`/`ModelSnapshot.cs` не сгенерированы вручную — их нужно получить штатным `dotnet ef migrations add` в полном решении; путь к `.csproj` в workflow — placeholder, поправьте под реальную структуру.