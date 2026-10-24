## Созданные/изменённые файлы

- `Model.cs` — сущности `Category`, `OrderCategory`, конфигурация many-to-many `Order.Categories` ↔ `Category.Orders` через таблицу `OrderCategories`; `Order.Category` пока оставлен.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` (+ `.Designer.cs`) — схемная миграция (создание таблиц и FK).
- `Migrations/20260929121500_BackfillOrderCategoriesFromOrderCategory.cs` (+ `.Designer.cs`) — идемпотентный бэкфилл данных из старой строковой колонки.
- `Migrations/ShopDbContextModelSnapshot.cs` — итоговый снэпшот модели.
- `.github/workflows/deploy-migration.yml` — ручной production-деплой миграции: idempotent SQL-скрипт, бэкап, применение в одной транзакции с `ON_ERROR_STOP`, защищённый environment.
- `_answer.md` — тот же текст ответа.

Решения: схема и данные разнесены на две миграции (аддитивный DDL отдельно от потенциально долгого бэкфилла); `Order.Category` намеренно не трогаем — уберём отдельной миграцией позже, когда весь код перейдёт на новые таблицы; так как в песочнице нет `.csproj` и исходного `Migrations`-снэпшота, Designer/Snapshot-файлы собраны вручную по `Model.cs` — в реальном репо их стоит перегенерировать через `dotnet ef migrations add`.