## Созданные/изменённые файлы

- `Model.cs` — добавлены `Category`, `OrderCategory`, навигация `Order.OrderCategories`, `DbSet`'ы и конфигурация связей в `OnModelCreating`; старая колонка `Order.Category` оставлена (помечена deprecated).
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — создаёт `Categories`/`OrderCategories`, бэкфиллит данные из `Orders.Category`, не трогает старую колонку.
- `.github/workflows/deploy.yml` — шаг деплоя миграции на production через `dotnet ef migrations bundle` + `efbundle --connection`, с гейтом через GitHub Environment `production`.

## Решения

- Миграция аддитивная (не дропает `Orders.Category`) — это нужно для безопасного rolling-деплоя, когда старая и новая версии приложения работают одновременно; удаление колонки — отдельная будущая миграция.
- Для прод-деплоя использован `dotnet ef migrations bundle` (не `database update`), т.к. это официально рекомендуемый EF Core способ для CI/CD: не требует SDK/исходников на сервере, а шаг применения гейтится ручным approval через GitHub Environment `production`.
- Designer/ModelSnapshot файлы миграции не сгенерированы вручную — в репозитории нет `.csproj` и истории предыдущих миграций/снапшота, а запускать `dotnet ef migrations add`/сборку было нельзя; в реальном окружении их нужно сгенерировать штатно командой `dotnet ef migrations add`, чтобы не рассинхронизировать `__EFMigrationsHistory`.

Тот же текст записан в `_answer.md`.