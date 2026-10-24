Созданы/изменены файлы:
- `Model.cs` — сущности `Category`, `OrderCategory` (join-таблица, составной PK), навигация `Order.OrderCategories`, конфигурация связей и уникального индекса в `ShopDbContext`; `Order.Category` (string) пока оставлен.
- `Migrations/20260929120000_AddCategoriesTable.cs` — создаёт `Categories` и `OrderCategories` (FK, индексы) и бэкфиллит их из текущей `Orders.Category`, саму колонку не удаляет.
- `Migrations/20260929120000_AddCategoriesTable.Designer.cs`, `Migrations/ShopDbContextModelSnapshot.cs` — снепшот модели.
- `.github/workflows/deploy-migrations.yml` — шаг `dotnet ef database update` на production через GitHub Environment `production` (с апрувом) и секрет `PRODUCTION_DB_CONNECTION_STRING`.

Решения: удаление `Order.Category` вынесено в отдельную будущую миграцию (как и просили); бэкфилл данных сделан прямым SQL с `TRIM`/`DISTINCT`/`ON CONFLICT DO NOTHING`, чтобы ничего не потерять при переходе на новую схему; так как в репозитории нет `.csproj`, пути в workflow и миграциях основаны на соглашении namespace `Shop.Data` — стоит сверить при интеграции (сборка/тесты не запускались). Тот же текст записан в `_answer.md`.