## Результаты

**Созданные файлы:**
- `OrderQueries.cs`

**Решения:**
- Методы (а) и (б) используют `Include()` для коллекций Items/Payments, `AsSplitQuery()` для двух коллекций, `AsNoTracking()` при чтении без изменений.
- Метод (в): условный фильтр по warehouse — если null, то любой склад; если указан, то точное совпадение.
- Метод (г): `ShippedAt.HasValue` отфильтровывает отправленные заказы, `Select(o => o.ShippedAt.Value)` возвращает DateTime (без null); если нет отправленных — возвращается `DateTime.MinValue`.