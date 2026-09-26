using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

public sealed class OverdueNotifier(
    IServiceScopeFactory serviceScopeFactory,
    ILogger<OverdueNotifier> logger) : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Period);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await SweepOverdueOrdersAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("{Service} is stopping.", nameof(OverdueNotifier));
        }
    }

    private async Task SweepOverdueOrdersAsync(CancellationToken stoppingToken)
    {
        try
        {
            // BackgroundService is a singleton; ShopDbContext is scoped, so resolve it per tick.
            await using var scope = serviceScopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

            // AuditLog.At has no HasColumnType -> Npgsql defaults it to timestamptz, which needs Kind=Utc.
            var nowUtc = DateTime.UtcNow;

            // Order.CreatedAt is mapped "timestamp without time zone" -> Npgsql rejects Kind=Utc there, needs Unspecified.
            var nowForCreatedAtCompare = DateTime.SpecifyKind(nowUtc, DateTimeKind.Unspecified);

            // Inlined, not Order.IsOverdue(now): EF Core throws on client evaluation inside Where.
            var overdueOrders = await db.Orders
                .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < nowForCreatedAtCompare)
                .ToListAsync(stoppingToken);

            if (overdueOrders.Count == 0)
                return;

            foreach (var order in overdueOrders)
            {
                db.AuditLogs.Add(new AuditLog
                {
                    At = nowUtc,
                    Text = $"Order {order.Id} overdue since {order.CreatedAt.AddDays(3):O}",
                });
            }

            await db.SaveChangesAsync(stoppingToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Keep the singleton service alive across a failed sweep; next tick retries.
            logger.LogError(ex, "Overdue orders sweep failed.");
        }
    }
}
