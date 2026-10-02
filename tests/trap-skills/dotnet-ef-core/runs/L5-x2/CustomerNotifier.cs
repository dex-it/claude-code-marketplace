using Microsoft.EntityFrameworkCore;

namespace Shop;

public class CustomerNotifier
{
    private const string Subject = "Уведомление";

    private readonly ShopDbContext _db;
    private readonly IEmailSender _emailSender;

    public CustomerNotifier(ShopDbContext db, IEmailSender emailSender)
    {
        _db = db;
        _emailSender = emailSender;
    }

    // customerIds приходит из маркетинговой системы - могут быть дубли, убираем их,
    // чтобы не отправить одному клиенту письмо дважды и не раздувать параметры запроса.
    public async Task NotifyCustomers(IEnumerable<Guid> customerIds, string text, CancellationToken ct = default)
    {
        var ids = customerIds.Distinct().ToList();
        if (ids.Count == 0) return;

        var emails = await _db.Customers
            .AsNoTracking()
            .Where(c => ids.Contains(c.Id))
            .Select(c => c.Email)
            .ToListAsync(ct);

        foreach (var email in emails)
        {
            await _emailSender.SendAsync(email, Subject, text, ct);
        }
    }
}
