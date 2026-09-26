---
name: dotnet-ef-core
description: EF Core - чек-лист запросов, трекинга, маппинга DateTime в Npgsql, soft-delete и каскада, миграций на production. Активируется при ef core, dbcontext, IQueryable, отчёт, read-only выборка, мягкое удаление, soft delete, HasQueryFilter, OnDelete, связи сущностей, DateTime, timestamp, timestamptz, Npgsql, value converter, деплой миграций, GitHub Actions, CI
---

# Entity Framework Core - чек-лист

Пункт называет ситуацию, которую изменение проверяет; решение - по документации EF Core / Npgsql версии из манифеста проекта.

- Нетранслируемое условие фильтра
- Трекинг выборки только для чтения
- `DateTime` и `timestamp` / `timestamptz` в Npgsql: с Npgsql 6 свойство без явного типа - `timestamptz`
- Soft-delete и каскад FK
- Применение миграции на production
