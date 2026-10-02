using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // IN-фильтр по id: список из маркетинговой системы может быть большим,
    // поэтому шлём запрос батчами, а не одним IN на все id сразу.
    private const int BatchSize = 500;

    private readonly ShopDbContext _db;
    private readonly IEmailSender _emailSender;

    public CustomerNotifier(ShopDbContext db, IEmailSender emailSender)
    {
        _db = db;
        _emailSender = emailSender;
    }

    public async Task NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)
    {
        // Внешний список может содержать дубли id - убираем перед запросом.
        var ids = customerIds.Distinct().ToList();

        foreach (var batch in Chunk(ids, BatchSize))
        {
            // Только чтение почты клиентов - без трекинга изменений.
            var emails = await _db.Customers
                .AsNoTracking()
                .Where(c => batch.Contains(c.Id))
                .Select(c => c.Email)
                .ToListAsync(ct);

            foreach (var email in emails)
            {
                if (string.IsNullOrWhiteSpace(email)) continue;
                await _emailSender.SendAsync(email, "Уведомление", text, ct);
            }
        }
    }

    private static IEnumerable<List<Guid>> Chunk(List<Guid> source, int size)
    {
        for (var i = 0; i < source.Count; i += size)
            yield return source.GetRange(i, Math.Min(size, source.Count - i));
    }
}
