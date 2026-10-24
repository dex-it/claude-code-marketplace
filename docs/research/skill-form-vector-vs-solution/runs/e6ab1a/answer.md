## Итог

**Созданные/изменённые файлы:**
- `Model.cs` — добавлены `Category`, `OrderCategory` (связка N..N с Order), навигация, конфигурация в `OnModelCreating`; `Order.Category` пока не тронут.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — схемная миграция (таблицы, FK, индексы).
- `Migrations/20260929120100_BackfillOrderCategories.cs` — отдельная data-миграция (перенос старых строковых категорий в новые таблицы).
- `.github/workflows/deploy-migration.yml` — генерация idempotent-скрипта миграции + применение на production за ручным approval (`environment: production`).

**Решения:** схема и данные разнесены по двум миграциям (правило SKILL.md); `Order.Category` не удаляю сейчас — это следующий шаг после переключения читателей; деплой в проде не использует `dotnet ef database update`, а генерирует SQL-скрипт для ревью и применяет его через `psql` в отдельном job'е с обязательным approval.

Полный текст ответа также записан в `work/_answer.md`. Миграции написаны вручную (без прогона `dotnet ef`, т.к. сборка была запрещена условием) — в репозитории нет `.csproj` и снапшота модели, так что перед мержем нужно прогнать `dotnet ef migrations add` локально для генерации `*.Designer.cs`/снапшота.