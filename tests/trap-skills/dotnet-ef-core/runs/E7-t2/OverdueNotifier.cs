using Microsoft.EntityFrameworkCore;

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

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessOverdueOrdersAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Overdue orders check failed");
            }
        }
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt is "timestamp without time zone": Npgsql 8 rejects a Utc-kind parameter here.
        var threshold = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-3), DateTimeKind.Unspecified);

        // Inlined, not o.IsOverdue(threshold): EF Core throws on an instance method in a Where predicate.
        var overdueOrderIds = await db.Orders
            .Where(o => o.ShippedAt == null && o.CreatedAt < threshold)
            .Select(o => o.Id)
            .ToListAsync(ct);

        if (overdueOrderIds.Count == 0)
            return;

        // AuditLog.At has no HasColumnType override: Npgsql maps DateTime to timestamptz, which needs Kind=Utc.
        var loggedAt = DateTime.UtcNow;
        db.AuditLogs.AddRange(overdueOrderIds.Select(id => new AuditLog
        {
            At = loggedAt,
            Text = $"Order {id} is overdue"
        }));

        await db.SaveChangesAsync(ct);
    }
}
