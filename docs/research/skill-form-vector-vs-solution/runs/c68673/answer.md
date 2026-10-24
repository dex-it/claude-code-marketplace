## Результат

**Созданные файлы:**
- `OrderQueries.cs` - сервис с четырьмя методами запросов

**О решениях:**

1. **GetOrderDetailsAsync** (а): загружает заказ со всеми Items и Payments через Include.

2. **GetCustomerOrdersAsync** (б): использует `IAsyncEnumerable` вместо `List` для эффективной обработки тысяч заказов без полной загрузки в памяти.

3. **GetProductBySkuAsync** (в): `warehouse` — nullable параметр; если не передан, берёт первый найденный продукт с таким SKU.

4. **GetLastShippedDateAsync** (г): возвращает `DateTime` (не nullable) с фильтром `ShippedAt.HasValue`; при отсутствии отгруженных заказов — `DateTime.MinValue`.