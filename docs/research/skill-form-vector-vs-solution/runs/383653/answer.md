Изменённые файлы:
- `Model.cs` — `Order.Complexity` + конфигурация в `OnModelCreating` (CHECK, конвертер `CreatedAt`, связи Items/Payments)
- `OrderRepository.cs` — метод `ClearItems(Guid orderId)`
- `_answer.md` — этот ответ

Решения:
- `Complexity` — обычное поле `int` с CHECK 1..5 в БД. Owned-Type/Value Object не делал: одно поле без инварианта. Для существующих строк миграции нужно значение по умолчанию (например, 1), иначе CHECK не пройдёт.
- `CreatedAt` остаётся `timestamp`. При записи значение переводится в UTC и получает `Kind=Unspecified`: Npgsql 6+ не пускает `Utc` в `timestamp`. При чтении ставится только `Kind=Utc`, без `ToLocalTime`. В локальное время переводить уже при отображении.
- Из-за мягкого удаления в БД нет каскада. У `Items` стоит `ClientCascade`: при `Items.Clear()` и required FK EF удаляет позиции-сироты. У `Payments` стоит `Restrict`. `ClearItems` загружает заказ через `Include`, без `AsSplitQuery`, делает `Clear()` и `SaveChangesAsync()`. Для удалённого или отсутствующего заказа возвращает `false`.

Сборку и тесты не запускал, миграцию не создавал.