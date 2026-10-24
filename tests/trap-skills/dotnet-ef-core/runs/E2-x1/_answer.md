Создан файл:
- /Users/anonymous/.cache/review/pr280/runs2/E2-X1/OrderQueries.cs

Решения:
- Все выборки `AsNoTracking()` (read-only), для (б) добавлен `AsSplitQuery()` + `IAsyncEnumerable`, т.к. у клиента тысячи заказов - без split query Items x Payments дают декартово произведение строк, а стриминг вместо `ToListAsync` не держит всё в памяти разом.
- GetProductBySkuAsync(sku, warehouse): при пустом/null warehouse не угадывает склад через FirstOrDefault, а явно считает кандидатов (0 / 1 / несколько) и бросает исключение при неоднозначности, требуя явный склад.
- GetLastShipDateAsync: проверка наличия через `AnyAsync` (а не `CountAsync() > 0`), возврат non-nullable `DateTime` - при отсутствии отгруженных заказов бросает исключение, а не подставляет "нулевую" дату. ShippedAt читается как `timestamptz` (Npgsql 8 default, Kind=Utc) без ручной конвертации, в отличие от CreatedAt с явным `timestamp without time zone`.
