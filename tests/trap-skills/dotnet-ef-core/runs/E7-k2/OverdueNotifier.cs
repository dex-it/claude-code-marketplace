using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Shop.Data;

// DbContext scoped, BackgroundService singleton - DbContext резолвится из своего scope на каждый тик.
public sealed class OverdueNotifier : BackgroundService
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
                await ProcessOverdueOrdersAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "OverdueNotifier tick failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt смаплен на "timestamp without time zone" - параметр обязан нести Kind=Unspecified, иначе Npgsql 6+ бросает при биндинге.
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-3), DateTimeKind.Unspecified);

        // Условие инлайн, не Order.IsOverdue(now): метод сущности в Where не транслируется и с EF Core 3+ бросает, а не считается на клиенте.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < cutoff)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
            return;

        // At без явного HasColumnType -> дефолт Npgsql 6+ timestamptz, нужен Kind=Utc - другой Kind, чем у cutoff, не опечатка.
        var loggedAt = DateTime.UtcNow;
        db.AuditLogs.AddRange(overdueOrders.Select(o => new AuditLog
        {
            At = loggedAt,
            Text = $"Order {o.Id} overdue: created {o.CreatedAt:O}, not shipped"
        }));

        await db.SaveChangesAsync(ct);
    }
}
