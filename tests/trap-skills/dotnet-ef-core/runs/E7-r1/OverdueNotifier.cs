using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

// AddHostedService registers this as singleton; ShopDbContext is scoped, so it is resolved per tick via a fresh scope.
public sealed class OverdueNotifier(
    IServiceScopeFactory scopeFactory,
    ILogger<OverdueNotifier> logger) : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Period);

        do
        {
            try
            {
                await ProcessOverdueOrdersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Overdue orders scan failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt is "timestamp without time zone" -> Kind must be Unspecified, or Npgsql throws on the parameter.
        var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);

        // Filter written as AddDays + comparison (server-translatable) instead of calling Order.IsOverdue(now), which is not.
        var overdue = await db.Orders
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < now)
            .Select(o => new { o.Id, o.CreatedAt })
            .ToListAsync(ct);

        if (overdue.Count == 0)
            return;

        foreach (var o in overdue)
        {
            db.AuditLogs.Add(new AuditLog
            {
                At = now,
                Text = $"Order {o.Id} overdue: created {o.CreatedAt:O}, not shipped within 3 days"
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
