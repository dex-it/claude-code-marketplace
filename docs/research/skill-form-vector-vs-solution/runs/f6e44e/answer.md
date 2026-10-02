Создан файл `CustomerNotifier.cs` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)`. Ответ также записан в `_answer.md`.

Решения:
- `customerIds` (из маркетинговой системы) обходится один раз через `Distinct().ToList()` — убирает дубли id и защищает от повторного перечисления «чужого» `IEnumerable`.
- Один батч-запрос `Where(c => ids.Contains(c.Id)).Select(c => c.Email)` вместо запроса в цикле и загрузки полных сущностей `Customer`; для Npgsql `Contains` по списку транслируется в `= ANY(@array)`, поэтому безопасен и для больших списков id.
- `ToListAsync()` стоит в конце цепочки (не в начале), письма рассылаются по уже материализованному списку email.