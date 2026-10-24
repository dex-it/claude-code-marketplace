## Итоги ревью MR !4210

**Критично (блокирует мердж):**
1. **`Services/CustomerOrders.cs` — `ActivePageAsync`**: `Skip(page * pageSize)` вместо `Skip((page - 1) * pageSize)`. Комментарий в коде явно говорит, что `page` нумеруется с 1, но при таком коде первая страница никогда не возвращается — все страницы сдвинуты на одну.

**Высокая:**
2. Там же — фильтр `o.Status == "Active"` не совпадает по регистру со значением по умолчанию `"active"` в `Model.cs` (`Order.Status`). Postgres сравнивает `text` с учётом регистра, так что метод рискует всегда возвращать пустой список.

**Средняя:**
3. `Services/OrderCard.cs` — `AsSplitQuery()` c `Include(Items)` + `Include(Payments)` даёт несколько раздельных SQL-запросов без общего снэпшота: между ними возможна гонка (например, добавлен платёж), и карточка заказа с деньгами станет несогласованной.
4. `Services/CustomerOrders.cs` — нет валидации `page >= 1` / `pageSize > 0` и верхней границы `pageSize`.

**Низкая:**
5. `Services/OrderCard.cs` — `OrderCardDto` напрямую отдаёт EF-сущности `OrderItem`/`Payment`, а не собственные view-модели (в отличие от `CartLine`/`OrderRow` в том же MR, сделанных правильно).
6. `Services/CartLookup.cs` — нет guard на `null` для `productIds`.
7. `Workers/AuditWriter.cs` — `WriteAsync` пишет только свободный текст без структурированных полей (actor/action/entity), что затруднит поиск по аудиту.

Полный текст с объяснениями и цитатами кода записан в `/Users/anonymous/.cache/research/runs/e62689/work/_answer.md`.