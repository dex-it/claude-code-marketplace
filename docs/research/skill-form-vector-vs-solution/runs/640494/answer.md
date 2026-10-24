## Созданные/изменённые файлы
- `Model.cs` — добавлены `Category`, `OrderCategory`, навигация `Order.OrderCategories`, DbSet'ы и конфигурация связей/уникального индекса в `OnModelCreating`; `Order.Category` пока оставлен.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — миграция: создаёт `Categories`/`OrderCategories`, индексы, бэкфиллит данные из `Order.Category`.
- `.github/workflows/deploy.yml` — джоба деплоя миграции на прод (`dotnet-ef database update` под `environment: production`) перед деплоем приложения.
- `.config/dotnet-tools.json` — манифест для `dotnet-ef` (нужен `dotnet tool restore` в workflow).
- `_answer.md` — тот же отчёт.

## Решения
Строковую колонку `Order.Category` не удаляю сейчас — это отдельная будущая миграция, как и попросили. В репозитории нет `.csproj`/папки `Migrations`/снапшота модели, а сборку запускать нельзя, поэтому миграцию написал руками в стандартном для EF Core 8 виде; `Designer.cs`/`ModelSnapshot.cs` не трогал — их нужно получить штатным `dotnet ef migrations add` в реальном проекте. Деплой миграции на прод сделан отдельной джобой с `environment: production` (approval gate) перед деплоем приложения.