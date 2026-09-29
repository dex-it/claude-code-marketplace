## Результаты ревью MR !4210

### 1. `Services/CustomerOrders.cs` — `ActivePageAsync` — off-by-one в пагинации
**Severity: high**
Контракт (комментарий в коде + MR.md) фиксирует нумерацию страниц с 1, но `Skip(page * pageSize)` вместо `Skip((page - 1) * pageSize)`. Первая страница (page=1) молча пропускает первые `pageSize` заказов — они не отображаются ни при каком допустимом значении `page`. Тихая потеря данных без исключения.

### 2. `Services/CustomerOrders.cs` — `ActivePageAsync` — сортировка без tie-breaker
**Severity: medium**
`OrderByDescending(CreatedAt)` без вторичного ключа — при равных `CreatedAt` порядок между запросами `Skip`/`Take` не гарантирован, возможны пропуски/дубли записей между страницами. Нужен `.ThenByDescending(o => o.Id)`.

### 3. `Services/CustomerOrders.cs` — `ActivePageAsync` — нет валидации `page`/`pageSize`
**Severity: low**
При `page = 0` (интуитивно ожидаемый "первый" для части вызывающих) `Skip` уходит в отрицательное значение — Postgres вернёт ошибку `OFFSET` вместо предсказуемого поведения.

### Без замечаний
- `Services/OrderCard.cs` — `AsNoTracking` + легитимный `AsSplitQuery` для двух коллекций одного уровня, `SingleOrDefaultAsync` по PK — корректно.
- `Services/CartLookup.cs` — `AsNoTracking`, проекция нужных полей, `Contains` на массиве id транслируется Npgsql в один параметр `ANY(...)`, безопасно для тысяч id.
- `Workers/AuditWriter.cs` — синхронный `Add` уместен, `DateTime.UtcNow` корректно пишется в колонку по умолчанию `timestamptz`.

Полный ответ также сохранён в `/Users/anonymous/.cache/research/runs/7e91ff/work/_answer.md`. Основная находка, которую стоит исправить до мерджа — пункт 1 (пагинация).