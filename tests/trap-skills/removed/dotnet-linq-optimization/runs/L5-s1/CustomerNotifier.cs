using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // Postgres деградирует на тысячах параметров IN — батчим id.
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
        // Внешняя система может присылать дубликаты id — контракт «один клиент, одно письмо».
        var uniqueIds = new HashSet<Guid>(customerIds);
        if (uniqueIds.Count == 0) return;

        foreach (var batch in uniqueIds.Chunk(BatchSize))
        {
            var emails = await _db.Customers
                .AsNoTracking()
                .Where(c => batch.Contains(c.Id))
                .Select(c => c.Email)
                .ToListAsync(ct);

            foreach (var email in emails)
            {
                await _emailSender.SendAsync(email, "Notification", text, ct);
            }
        }
    }
}
