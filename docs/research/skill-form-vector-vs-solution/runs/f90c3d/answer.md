## Задача выполнена

**Изменённые файлы:**
1. **Model.cs** — добавлены Complexity в Order, HasConversion для CreatedAt, отношения с Restrict для Items/Payments
2. **OrderRepository.cs** — добавлен метод ClearItemsAsync
3. **_answer.md** — создан файл с решением

**Ключевые решения:**
- **Complexity**: простое целое поле в Order (не Owned-Type из одного значения, как указано в SKILL.md)
- **CreatedAt UTC**: HasConversion нормализует код→UTC в `Kind=Unspecified` для БД; чтение помечает как UTC. Колонка `timestamp without time zone` не изменяется, совместима с отчётами DBA
- **Soft-delete**: OnDelete(DeleteBehavior.Restrict) блокирует каскадное физическое удаление позиций/платежей при soft-delete заказа; query filter скрывает помечены удалённые
- **ClearItems**: использован ExecuteDeleteAsync (bulk operation per SKILL.md) вместо загрузки в память