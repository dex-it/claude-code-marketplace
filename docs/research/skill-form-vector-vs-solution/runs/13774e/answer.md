## Итог

Созданные/изменённые файлы:
- `Model.cs` — изменён: добавлены `Category`, `OrderCategory` (join-сущность), навигация `Order.OrderCategories`; в `OnModelCreating` — composite PK, уникальный индекс на `Category.Name`, FK (`Cascade` на Order / `Restrict` на Category), `HasQueryFilter` на `OrderCategory`, зеркалящий soft-delete фильтр `Order`. `Order.Category` пока оставлена.
- `Migrations/20260929120000_AddCategoriesAndOrderCategories.cs` — новая: только схема (таблицы `Categories`, `OrderCategories`, индексы, FK).
- `Migrations/20260929120001_BackfillOrderCategoriesData.cs` — новая: только данные (SQL-бэкфилл из старой строковой колонки, включая soft-deleted заказы).
- `.github/workflows/deploy-migrations.yml` — новый: джоба `migrate-production` в GitHub Environment `production`, собирает self-contained `dotnet ef migrations bundle` и применяет к прод-БД по секрету.

Решения: схема и данные разнесены по двум миграциям, бэкфилл — raw SQL, а не построчный SaveChanges; удаление `Order.Category` отложено до отдельной будущей миграции после переключения кода (expand/contract). Designer/Snapshot-файлы не сгенерированы вручную — по ограничениям задачи `dotnet ef`/сборка не запускались, это нужно сделать локально перед мержем. Тот же текст записан в `_answer.md`.