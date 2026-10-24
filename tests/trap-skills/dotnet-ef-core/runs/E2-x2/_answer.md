Создан файл:
- /Users/anonymous/.cache/review/pr280/runs2/E2-X2/OrderQueries.cs — сервис OrderQueries с четырьмя read-only методами (GetOrderCardAsync, GetCustomerOrdersAsync, GetProductBySkuAsync, GetLastShippedAtAsync).

Решения:
- Все выборки AsNoTracking (read-only); карточка заказа и выгрузка заказов клиента — AsSplitQuery, чтобы Include(Items)+Include(Payments) не давали cartesian-explosion; выгрузка заказов клиента отдаётся как IAsyncEnumerable<Order>, чтобы не буферизовать тысячи заказов в List сразу.
- GetProductBySkuAsync: фильтр по Sku, и по Warehouse только если он задан; используется SingleOrDefaultAsync — при неоднозначности (SKU на нескольких складах и warehouse не передан) метод бросает исключение вместо тихой выдачи случайного товара с чужого склада.
- GetLastShippedAtAsync возвращает non-nullable DateTime через MaxAsync(ShippedAt) с фильтром ShippedAt != null; если отгруженных заказов нет — бросает InvalidOperationException, а не выдаёт фиктивную дату.
- Soft-delete фильтр Order (!IsDeleted) применяется автоматически ко всем запросам, т.к. они идут через _db.Orders без IgnoreQueryFilters().
