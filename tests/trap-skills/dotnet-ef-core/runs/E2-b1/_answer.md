Создан файл:
- /Users/anonymous/.cache/review/pr280/runs/E2-N1/OrderQueries.cs — сервис OrderQueries с методами GetOrderCardAsync(Guid), GetCustomerOrdersAsync(Guid), GetProductBySku(string sku, string? warehouse), GetLastShippedDateAsync(Guid).

Ключевые решения:
- Для (а) и (б) используется AsSplitQuery() при двух Include (Items, Payments), чтобы не получать декартово произведение строк; для (б) это критично, т.к. у клиента бывают тысячи заказов. Везде AsNoTracking(), т.к. запросы только на чтение.
- Для (в) при переданном warehouse ищем точное совпадение (Sku, Warehouse); если warehouse не передан, а SKU встречается на нескольких складах — это неразрешимая по одному SKU неоднозначность, поэтому бросаем InvalidOperationException с перечнем складов вместо угадывания склада.
- Для (г) метод возвращает non-nullable DateTime, поэтому при отсутствии у клиента отгруженных заказов бросается InvalidOperationException (вместо DateTime.MinValue), чтобы не путать "нет данных" с реальной датой.
