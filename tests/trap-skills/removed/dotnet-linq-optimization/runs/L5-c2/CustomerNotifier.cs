using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // Батч IN-списка: Npgsql/Postgres не рассчитаны на десятки тысяч параметров в одном запросе.
    private const int BatchSize = 500;
    private const string Subject = "Уведомление";

    private readonly ShopDbContext _db;
    private readonly IEmailSender _emailSender;

    public CustomerNotifier(ShopDbContext db, IEmailSender emailSender)
    {
        _db = db;
        _emailSender = emailSender;
    }

    public async Task NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)
    {
        // Материализуем один раз: источник (маркетинговая система) может быть ленивым перечислением.
        var ids = customerIds.Distinct().ToList();
        if (ids.Count == 0) return;

        foreach (var batch in ids.Chunk(BatchSize))
        {
            var emails = await _db.Customers
                .AsNoTracking()
                .Where(c => batch.Contains(c.Id))
                .Select(c => c.Email)
                .ToListAsync(ct);

            foreach (var email in emails)
            {
                if (string.IsNullOrWhiteSpace(email)) continue;

                // Последовательно: не заваливать почтовый провайдер параллельным Task.WhenAll.
                await _emailSender.SendAsync(email, Subject, text, ct);
            }
        }
    }
}
