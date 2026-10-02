## Изменённые/созданные файлы
- Создан `CustomerNotifier.cs` — класс `CustomerNotifier` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)`.

## Решения
- Список `customerIds` приходит из внешней (маркетинговой) системы, поэтому не считаем его доверенным: берём email только по клиентам, реально найденным в БД, а не рассылаем "вслепую" по переданным id.
- Id дедуплицируются и обрабатываются пачками по 500 (`Chunk`), чтобы не упереться в лимит размера `IN (...)` при большом списке; запрос через `AsNoTracking`, т.к. данные только читаются.
- Пустые email пропускаются перед вызовом `IEmailSender.SendAsync`.

Тот же ответ записан в `_answer.md`.