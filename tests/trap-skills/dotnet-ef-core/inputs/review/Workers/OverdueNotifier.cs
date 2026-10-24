using Microsoft.Extensions.Hosting;

namespace Shop.Data.Workers;

public class OverdueNotifier : BackgroundService
{
    private readonly ShopDbContext _db;
    public OverdueNotifier(ShopDbContext db) => _db = db;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var now = DateTime.UtcNow;
            var border = DateTime.SpecifyKind(now.AddDays(-3), DateTimeKind.Unspecified);
            var overdue = await _db.Orders
                .Where(o => o.ShippedAt == null && o.CreatedAt < border)
                .Select(o => o.Id)
                .ToListAsync(ct);
            foreach (var id in overdue)
                _db.AuditLogs.Add(new AuditLog { At = now, Text = $"overdue {id}" });
            await _db.SaveChangesAsync(ct);
            await Task.Delay(TimeSpan.FromMinutes(1), ct);
        }
    }
}
