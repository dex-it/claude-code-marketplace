using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    // Внешний список неизвестного размера - батчим IN, не тянем всю таблицу.
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
        // Distinct + материализация: вход может быть одноразовым и с дублями.
        var distinctIds = customerIds.Distinct().ToArray();

        foreach (var batch in distinctIds.Chunk(BatchSize))
        {
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
}
