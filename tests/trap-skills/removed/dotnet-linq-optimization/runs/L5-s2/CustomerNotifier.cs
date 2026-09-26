using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // PostgreSQL деградирует на больших списках параметров IN - режем на батчи.
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
        // Маркетинговая система не гарантирует уникальность id, а контракт - одно письмо на клиента.
        var uniqueIds = new HashSet<Guid>(customerIds);
        if (uniqueIds.Count == 0) return;

        foreach (var batch in uniqueIds.Chunk(BatchSize))
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
