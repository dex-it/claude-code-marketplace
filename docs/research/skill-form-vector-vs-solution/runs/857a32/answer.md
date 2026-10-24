Созданные файлы:
- `CustomerNotifier.cs` — новый класс `CustomerNotifier` с методом `NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)`.
- `_answer.md` — этот ответ.

Решения: id из маркетинговой системы не считаются доверенными — список дедуплицируется и разбивается на батчи по 500, реальные email берутся запросом к `ShopDbContext.Customers` по существующим id (несуществующие id просто игнорируются). Письма отправляются через `IEmailSender.SendAsync` для каждого найденного клиента, зависимости внедряются через конструктор по образцу `ProductRepository`.