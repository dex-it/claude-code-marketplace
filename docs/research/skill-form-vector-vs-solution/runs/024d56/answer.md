Готово! Я создал сервис OrderQueries в файле **OrderQueries.cs** с четырьмя методами согласно поручению:

**Созданные/изменённые файлы:**
- `OrderQueries.cs` (новый)

**Ключевые решения:**
- **Split Query** для методов с множественными Include (Items и Payments), чтобы избежать картезианского произведения — антипаттерн из SKILL.md
- **IAsyncEnumerable** для GetCustomerOrdersAsync, позволяя эффективно работать с тысячами заказов без загрузки всех в память
- **string? warehouse** для GetProductBySkuAsync, поддерживая передачу только SKU с null в качестве значения по умолчанию
- **DateTime.MinValue** как значение при отсутствии отгруженных заказов (non-nullable требование)

Результат записан в `/Users/anonymous/.cache/research/runs/024d56/work/_answer.md`.