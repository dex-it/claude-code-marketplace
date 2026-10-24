using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // Список из маркетинговой системы может быть огромным - без батчей Contains() даёт SQL IN() с тем же числом параметров и упирается в лимит Npgsql.
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
        foreach (var batch in customerIds.Chunk(BatchSize))
        {
            var emails = await _db.Customers
                .Where(c => batch.Contains(c.Id))
                .Select(c => c.Email)
                .ToListAsync(ct);

            foreach (var email in emails)
            {
                await _emailSender.SendAsync(email, "Уведомление", text, ct);
            }
        }
    }
}
