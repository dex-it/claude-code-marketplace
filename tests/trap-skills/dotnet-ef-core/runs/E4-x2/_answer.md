Изменённые файлы:
- /Users/anonymous/.cache/review/pr280/runs2/E4-X4/Model.cs
- /Users/anonymous/.cache/review/pr280/runs2/E4-X4/OrderRepository.cs

Решения:
- Complexity: int-свойство на Order (1..5), IsRequired() + CHECK-constraint на таблице ("Complexity" BETWEEN 1 AND 5) — валидность значения гарантируется на уровне БД, а не только кода.
- CreatedAt: колонку не трогаем (остаётся timestamp without time zone для отчётов DBA). Добавлен ValueConverter<DateTime,DateTime>: при записи Kind снимается до Unspecified (иначе Npgsql 6+ бросает исключение при Kind=Utc в timestamp without time zone), при чтении значение помечается Kind=Utc — в коде CreatedAt всегда UTC независимо от таймзоны клиента, писавшего DateTime.UtcNow.
- Order -> Items / Order -> Payments сконфигурированы явно в OnModelCreating с HasForeignKey + IsRequired + OnDelete(DeleteBehavior.ClientCascade): каскад удаления зависимых работает в change tracker EF (нужно для мягкого удаления Order и для ClearItems), но в БД FK без ON DELETE CASCADE — прямой DELETE строки Order в обход soft-delete не снесёт Items/Payments автоматически, и разрыв required-связи не бросает исключение.
- ClearItemsAsync(Guid orderId) в OrderRepository: подгружает заказ с Include(Items), делает Items.Clear() и SaveChangesAsync — позиции реально удаляются благодаря ClientCascade.
