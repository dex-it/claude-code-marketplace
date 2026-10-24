## Созданные/изменённые файлы

- `Model.cs` — изменён: добавлены `Category`, `OrderCategory`, навигация `Order.Categories`, `DbSet<Category>`, конфигурация many-to-many через явный join-entity `OrderCategory` → таблица `OrderCategories`; `Order.Category` (string) оставлен как есть — удалим отдельной миграцией позже.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — новая схемная миграция: `Categories` (уникальный индекс по `Name`) + `OrderCategories` (composite PK, FK на `Orders` с Cascade, FK на `Categories` с Restrict).
- `Migrations/20260929120100_BackfillOrderCategories.cs` — новая data-миграция: переносит исторические `Order.Category` в `Categories`/`OrderCategories`; вставка в `OrderCategories` — батчами по 5000 с промежуточными `COMMIT`, чтобы не держать одну длинную транзакцию на всей таблице `Orders`.
- `.github/workflows/deploy-production.yml` — новый workflow: job генерации idempotent SQL-скрипта (`dotnet ef migrations script --idempotent`) → артефакт, затем job применения с `environment: production` (ручной approval-гейт) через `psql`.
- `_answer.md` — тот же текст ответа.

## Решения

Схема и данные разнесены по двум миграциям (правило SKILL.md против смешивания DDL и данных); удаление `Order.Category` сознательно не включено — по условию задачи это отдельный будущий шаг. Деплой в CI не делает `dotnet ef database update` напрямую — только idempotent-скрипт, ревью артефакта человеком через approval окружения `production`, и только затем применение `psql`-ом.

Замечу: в репозитории нет `.csproj`/существующей папки `Migrations` — я не запускал `dotnet ef`, а написал `Up/Down` и атрибуты `[Migration]`/`[DbContext]` вручную по конвенциям EF Core 8; в реальном проекте стоит прогнать `dotnet ef migrations add` — это заодно перегенерирует `ModelSnapshot.cs`, которого здесь нет.