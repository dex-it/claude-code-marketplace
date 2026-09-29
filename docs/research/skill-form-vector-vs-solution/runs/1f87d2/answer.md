Готово! Выполнены все задачи:

**Изменённые файлы:**
- `Model.cs` — добавлено поле `Complexity`, настроен `ValueConverter` для CreatedAt (UTC ↔ Unspecified), конфигурированы связи Items/Payments
- `OrderRepository.cs` — добавлен метод `ClearItems`
- `_answer.md` — описание решений

**Ключевые решения:**
- CreatedAt: `ValueConverter` преобразует `DateTime.UtcNow` из кода в `Unspecified` для БД (timestamp без timezone) и обратно
- Soft-delete: `HasQueryFilter` на Order автоматически исключает удалённые заказы, что предотвращает загрузку их Items/Payments
- ClearItems: использует `Include`, `Clear()` и `SaveChanges()` согласно правилу разрыва required-связи