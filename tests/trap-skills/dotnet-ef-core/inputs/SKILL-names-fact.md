---
name: dotnet-ef-core
description: EF Core - чек-лист
---

# Entity Framework Core - чек-лист

- Нетранслируемое условие фильтра
- Трекинг выборки только для чтения
- `DateTime` и `timestamp` / `timestamptz` в Npgsql: с Npgsql 6 свойство без явного типа - `timestamptz`
- Soft-delete и каскад FK
- Применение миграции на production
