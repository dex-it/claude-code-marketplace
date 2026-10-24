Создан файл:
- /Users/anonymous/.cache/review/pr280/runs/E2-O2/OrderQueries.cs — сервис OrderQueries + DTO (OrderItemDto, PaymentDto, OrderCardDto, CustomerOrderDto).

Решения:
- (а)/(б) — проекция в DTO вместо Include: EF строит корреллированные подзапросы для Items/Payments вместо JOIN, поэтому cartesian explosion не возникает и AsSplitQuery не нужен ни для одной записи, ни для списка; для (б) добавлен AsNoTracking и возврат IAsyncEnumerable, чтобы не держать тысячи заказов клиента с их items/payments в памяти одновременно.
- (в) GetProductBySku(sku, warehouse) — warehouse сделан nullable; при заданном warehouse фильтр по sku+warehouse (уникально), при null — если по sku несколько складов, метод не молчит и не берёт случайный (Single() бросил бы малоинформативную ошибку) — явно кидает исключение с просьбой уточнить склад, обнаруживая неоднозначность через Take(2), не вычитывая все совпадения.
- (г) GetLastShippedAtAsync — MaxAsync(ShippedAt) выполняется в SQL (агрегация не в памяти); контракт метода — не-nullable DateTime, поэтому отсутствие отгруженных заказов трактуется как ошибка вызова (InvalidOperationException), а не как null/MinValue.
