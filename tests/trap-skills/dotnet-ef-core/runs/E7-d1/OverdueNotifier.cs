using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Shop.Data;

public class OverdueNotifier : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OverdueNotifier> _logger;

    public OverdueNotifier(IServiceScopeFactory scopeFactory, ILogger<OverdueNotifier> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Period);
        do
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Overdue orders sweep failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        var utcNow = DateTime.UtcNow;
        // CreatedAt is "timestamp without time zone": Npgsql rejects a Kind=Utc parameter against it.
        var cutoff = DateTime.SpecifyKind(utcNow, DateTimeKind.Unspecified);

        // Inlined instead of o.IsOverdue(cutoff): EF Core does not translate instance method calls.
        var overdueOrderIds = await db.Orders
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < cutoff)
            .Select(o => o.Id)
            .ToListAsync(ct);

        if (overdueOrderIds.Count == 0)
            return;

        foreach (var orderId in overdueOrderIds)
        {
            // At has no HasColumnType override, so it defaults to "timestamp with time zone": needs Kind=Utc.
            db.AuditLogs.Add(new AuditLog { At = utcNow, Text = $"Order {orderId} is overdue (not shipped within 3 days)." });
        }

        await db.SaveChangesAsync(ct);
        _logger.LogInformation("Recorded {Count} overdue order(s)", overdueOrderIds.Count);
    }
}
