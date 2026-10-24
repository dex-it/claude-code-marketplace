## Итог

**Изменено:**
- `Model.cs` — добавлены `Category`, `OrderCategory` (join-сущность), навигация `Order.Categories`, конфигурация many-to-many с `.ToTable("OrderCategories")`; `Order.Category` оставлена с TODO на удаление позже.

**Создано:**
- `Migrations/20260929100000_AddCategoriesAndOrderCategories.cs` — схемная миграция (DDL: таблицы `Categories`, `OrderCategories`, FK, индексы).
- `Migrations/20260929100100_MigrateOrderCategoryData.cs` — data-миграция (перенос исторических значений `Order.Category`, идемпотентная).
- `.github/workflows/deploy-migrations.yml` — генерация idempotent SQL-скрипта + отдельный job применения на prod за GitHub Environment с required reviewers (без прямого `dotnet ef database update`).
- `_answer.md` — этот же ответ.

**Ключевые решения:** схема и данные разнесены на две миграции (правило команды — не блокировать `Orders` на время INSERT); удаление колонки `Order.Category` отложено в отдельную будущую миграцию; Designer/Snapshot-файлы не сфабрикованы вручную (в каталоге нет `.csproj`/существующего snapshot, а запускать `dotnet ef` было запрещено) — это отмечено как шаг, который нужно выполнить командой перед мержем.