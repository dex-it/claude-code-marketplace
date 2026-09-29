Провёл ревью изменённых файлов (`Services/OrderCard.cs`, `Services/CartLookup.cs`, `Services/CustomerOrders.cs`, `Workers/AuditWriter.cs`) с учётом существующей модели (`Model.cs`). Результат записан в `/Users/anonymous/.cache/research/runs/4e2f6f/work/_answer.md`.

## Находки

**1. `Services/CustomerOrders.cs` — `ActivePageAsync` — off-by-one в пагинации**
`Skip(page * pageSize)` при нумерации страниц с 1 сдвигает всё на одну страницу: настоящая первая страница никогда не отдаётся, для `page=1` возвращается вторая. Нужно `Skip((page - 1) * pageSize)`.
**Severity: critical**

**2. `Services/CustomerOrders.cs` — `ActivePageAsync` — несовпадение регистра статуса**
Фильтр `o.Status == "Active"`, а дефолт в модели — `"active"` (нижний регистр). Сравнение регистрозависимое (Postgres `=`), метод может систематически возвращать пусто для всех активных заказов.
**Severity: high**

**3. `Services/CustomerOrders.cs` — `ActivePageAsync` — нет валидации `page`/`pageSize`**
Отрицательный/нулевой `page` или `pageSize` не проверяются — упадёт исключение из провайдера или вернётся некорректный результат.
**Severity: medium**

**4. `Services/CustomerOrders.cs` — `ActivePageAsync` — нестабильная сортировка**
Только `OrderByDescending(CreatedAt)` без tie-breaker — при совпадающих датах между запросами страницы могут дублировать или терять записи.
**Severity: medium**

**5. `Services/CartLookup.cs` — `GetAsync` — нет ограничения размера входного списка id**
MR сам описывает вход «от одного до нескольких тысяч id», но верхней границы нет — потенциальный вектор DoS/деградации при аномально большом списке.
**Severity: medium**

**6. `Workers/AuditWriter.cs` — `WriteAsync` — аудит без идентификатора актора/типа действия**
Пишется только свободный текст и время, нет структурированных полей «кто/что/над чем» — журнал по действиям оператора невозможно фильтровать/агрегировать по оператору или объекту, что подрывает саму цель аудита.
**Severity: medium**

**7. `Workers/AuditWriter.cs` — `WriteAsync` — нет проверки входного `text`**
Нет проверки на `null`/пустоту/длину; при ограничении длины колонки в БД возможен сбой `SaveChangesAsync`.
**Severity: low**

**8. `Services/OrderCard.cs` — `GetAsync` — глобальный query filter скрывает soft-deleted заказы**
Наследуется существующий `HasQueryFilter(!IsDeleted)`, из-за чего карточка для "удалённого" заказа молча вернёт `null` — если оператору иногда нужно это видеть, поведение не проверено/не задокументировано.
**Severity: low**

Рекомендую блокировать мердж минимум до исправления пунктов 1 и 2 — это функциональные баги, ломающие заявленную в MR фичу пагинации заказов клиента.