using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // customerIds приходит из маркетинговой системы и может быть большим/не буферизованным целиком,
    // поэтому список читается и запрашивается в БД пачками, а не одним IN(...) на все id сразу.
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
        foreach (var batch in Chunk(customerIds, BatchSize))
        {
            // Только чтение - трекинг не нужен.
            var emails = await _db.Customers
                .AsNoTracking()
                .Where(c => batch.Contains(c.Id))
                .Select(c => c.Email)
                .ToListAsync(ct);

            foreach (var email in emails)
            {
                await _emailSender.SendAsync(email, "Уведомление", text, ct);
            }
        }
    }

    private static IEnumerable<List<Guid>> Chunk(IEnumerable<Guid> source, int size)
    {
        var batch = new List<Guid>(size);
        foreach (var id in source)
        {
            batch.Add(id);
            if (batch.Count == size)
            {
                yield return batch;
                batch = new List<Guid>(size);
            }
        }

        if (batch.Count > 0)
        {
            yield return batch;
        }
    }
}
