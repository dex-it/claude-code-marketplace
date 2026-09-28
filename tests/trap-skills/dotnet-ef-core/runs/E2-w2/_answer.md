Создан файл:
- /Users/anonymous/.cache/review/pr280/runs/E2-W2/OrderQueries.cs — сервис OrderQueries с методами GetOrderCardAsync (а), GetCustomerOrdersAsync (б), GetProductBySku (в), GetLastShippedAtAsync (г).

Ключевые решения:
- Везде AsNoTracking (read-only), для (а)/(б) — AsSplitQuery, т.к. Include двух независимых коллекций (Items+Payments) в одном JOIN даёт декартово произведение; для (б) выборка тысяч заказов клиента отдаётся потоково через IAsyncEnumerable с обязательным OrderBy (без него split-запросы могут разъехаться по строкам), а не ToListAsync.
- GetProductBySku принимает `string? warehouse` (не `string`, раз склад может быть null) и фильтрует условием `warehouse == null || p.Warehouse == warehouse` — это переводимый в SQL паттерн опционального фильтра; SingleOrDefaultAsync намеренно бросает исключение при неоднозначном совпадении (sku без warehouse на нескольких складах), а не молча возвращает случайный товар.
- GetLastShippedAtAsync считает MAX(ShippedAt) в БД среди заказов с ShippedAt != null; при отсутствии отгруженных заказов у клиента метод бросает InvalidOperationException (пустая последовательность для non-nullable DateTime) — соответствует контракту "не nullable".
