**Готово.** Создан сервис **OrderQueries.cs** с четырьмя методами:

- **(а) GetOrderCardAsync** – карточка заказа со всеми Items и Payments через Include
- **(б) GetCustomerOrdersAsync** – с **AsSplitQuery()** для избежания cartesian explosion на тысячах заказов (генерирует отдельные SQL запросы для Orders, Items, Payments вместо одного большого JOIN)
- **(в) GetProductBySku** – параметр warehouse nullable; если передан, фильтрует точно, если null, берёт первый (так как SKU может быть на разных складах)
- **(г) GetLastShippedDateAsync** – последняя дата отгрузки через OrderByDescending, возвращает default(DateTime) если нет отгруженных

Все методы используют **AsNoTracking()** (read-only), **Include** вместо ленивой загрузки (избежание N+1), фильтры на сервере в IQueryable.

Ответ сохранён в `_answer.md`.