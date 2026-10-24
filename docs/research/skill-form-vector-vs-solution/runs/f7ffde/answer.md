## Изменённые/созданные файлы

- `Model.cs` — добавлены `Category`, `OrderCategory`, `DbSet`'ы и конфигурация в `OnModelCreating` (уникальный индекс `Categories.Name`, композитный ключ и FK для `OrderCategories`, matching `HasQueryFilter` из-за soft-delete на `Order`); `Order.Category` пока оставлен.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — только схема: `Categories`, `OrderCategories`, индексы, FK.
- `Migrations/20260929120100_BackfillOrderCategories.cs` — только перенос данных, set-based `INSERT ... SELECT ... ON CONFLICT DO NOTHING`, идемпотентна.
- `.github/workflows/deploy.yml` — джоб `migrate-database` (production environment с ручным approval): генерирует идемпотентный SQL через `dotnet ef migrations script --idempotent` и применяет его `psql`'ем с `lock_timeout`/`statement_timeout`, до джоба деплоя приложения.
- `_answer.md` — этот же ответ.

## Решения

Схема и данные разнесены на две отдельные миграции, применяемые до деплоя нового кода — так можно откатить/повторить каждую часть независимо, и старая версия приложения (ещё читающая `Order.Category`) не ломается. Столбец `Order.Category` не удаляется сейчас — это отдельная будущая миграция, когда весь код перестанет его использовать. Designer/Snapshot-файлы миграций вручную не создавал — в проекте нет `.csproj`, а запуск `dotnet ef`/сборки был запрещён условиями задачи; их нужно сгенерировать обычным `dotnet ef migrations add` перед мержем в реальном проекте.