using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // Батч ограничивает размер WHERE IN: источник - внешняя система, размер списка не гарантирован.
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
        var ids = customerIds.Distinct().ToList();

        foreach (var batch in ids.Chunk(BatchSize))
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
