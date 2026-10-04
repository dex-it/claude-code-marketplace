Созданные/изменённые файлы:
- `CustomerNotifier.cs` (новый) — класс `CustomerNotifier` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)`.
- `_answer.md` — записан этот же ответ.

Решения: id из маркетинговой системы дедуплицируются и одним запросом (`Contains`) сопоставляются с email-адресами реальных клиентов в БД — несуществующие id просто отсеиваются без ошибок; пустые email пропускаются, а рассылка идёт через `IEmailSender.SendAsync`.