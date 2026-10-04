---
name: dotnet-ef-core
description: EF Core - чек-лист запросов, трекинга, маппинга DateTime в Npgsql, soft-delete и каскада, миграций на production. Активируется при ef core, dbcontext, IQueryable, отчёт, read-only выборка, мягкое удаление, soft delete, HasQueryFilter, OnDelete, связи сущностей, DateTime, timestamp, timestamptz, Npgsql, value converter, деплой миграций, GitHub Actions, CI
---

# Entity Framework Core - чек-лист

Пункт называет ситуацию, которую изменение проверяет; решение - по документации EF Core / Npgsql версии из манифеста проекта.

- Нетранслируемое условие фильтра
- Трекинг выборки только для чтения
- Дубли во входном списке id
- `DateTime` и тип колонки в Npgsql: с Npgsql 6 свойство без явного типа - `timestamptz` и пишется `Kind=Utc`; в `timestamp without time zone` пишется `Kind=Unspecified`, прочитанное помечается `Utc`
- Soft-delete (`HasQueryFilter`) при required FK: FK в БД без каскада; зависимые удаляет код, и разрыв required-связи не бросает исключение
- Применение миграции на production
