Создан файл: /Users/anonymous/.cache/review/pr280/runs2/L5-F1/CustomerNotifier.cs

CustomerNotifier(ShopDbContext, IEmailSender).NotifyCustomers(customerIds, text, ct = default):
- дубли id из внешнего (маркетингового) списка убираются через Distinct() перед запросом;
- выборка email только для чтения - AsNoTracking() + Select(c => c.Email), без лишних сущностей и трекинга;
- IN-фильтр по id разбит на батчи по 500, чтобы не собирать один гигантский IN для потенциально большого списка из маркетинговой системы;
- письмо через IEmailSender.SendAsync шлётся на каждый найденный email; пустые/отсутствующие email пропускаются, id, которых нет в базе, просто не попадают в выборку.
