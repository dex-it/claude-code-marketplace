using Microsoft.EntityFrameworkCore;

namespace Shop.Workers;

/// <summary>
/// Раз в минуту находит просроченные (не отправленные более 3 суток) заказы и пишет запись в AuditLog.
/// </summary>
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
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Один неудачный проход не должен останавливать воркер - следующий тик повторит попытку.
                _logger.LogError(ex, "OverdueNotifier: не удалось обработать просроченные заказы");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        // ShopDbContext - scoped, BackgroundService - singleton: контекст берём через отдельный scope на проход.
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt смаппирован на timestamp without time zone: Npgsql 6+ требует Kind=Unspecified для неё, а не Utc.
        var threshold = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-3), DateTimeKind.Unspecified);

        // Условие Order.IsOverdue продублировано явно - инстансный метод EF Core в SQL не транслирует.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < threshold)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
        {
            return;
        }

        var loggedAt = DateTime.UtcNow;
        db.AuditLogs.AddRange(overdueOrders.Select(o => new AuditLog
        {
            At = loggedAt,
            Text = $"Order {o.Id} overdue: created {o.CreatedAt:O}, not shipped",
        }));

        await db.SaveChangesAsync(ct);

        _logger.LogInformation("OverdueNotifier: записано {Count} просроченных заказов", overdueOrders.Count);
    }
}
