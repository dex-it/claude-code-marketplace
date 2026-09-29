## Изменённые/созданные файлы

- `Model.cs` — добавлены `Category`, `OrderCategory` (join-сущность), `DbSet<Category>`, конфигурация связки в `OnModelCreating`; `Order.Category` (string) пока не трогаю — удалим отдельной миграцией позже.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` (+ `.Designer.cs`) — схемная миграция: таблицы `Categories`, `OrderCategories` (композитный PK, FK `Restrict`, уникальный индекс `Categories.Name`).
- `Migrations/20260929120100_BackfillOrderCategories.cs` (+ `.Designer.cs`) — отдельная data-миграция: переносит уникальные значения `Orders.Category` в `Categories` и заполняет `OrderCategories` (raw SQL, учитывает и soft-deleted заказы, т.к. без EF query filter).
- `Migrations/ShopDbContextModelSnapshot.cs` — итоговый снапшот модели.
- `.github/workflows/deploy-migrations.yml` — генерация идемпотентного SQL (`dotnet ef migrations script --idempotent`) артефактом на ревью, затем применение на production через `psql` в отдельном job'е с GitHub Environment (ручной approve), без `dotnet ef database update` на проде.
- `_answer.md` — тот же ответ.

## Решения

- Схема и данные разнесены на две миграции, backfill — raw SQL, а не материализация всех `Orders` в EF; FK связки — `Restrict` (не `Cascade`), т.к. у `Order` soft-delete через query filter.
- Деплой на прод — только ревью SQL-артефакта + ручной approve через Environment, применение `psql`-ом, согласно правилу SKILL.md против `dotnet ef database update` в CI.
- Поскольку в репозитории нет `.csproj`/истории миграций и сборка запрещена условием задачи, `Designer.cs`/`ModelSnapshot.cs` написаны вручную — перед мержем стоит прогнать `dotnet ef migrations add`/`has-pending-model-changes` локально, чтобы сверить со сгенерированным EF снапшотом.