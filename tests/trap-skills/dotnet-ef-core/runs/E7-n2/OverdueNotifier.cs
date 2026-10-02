using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Раз в минуту находит заказы, просроченные более 3 суток без отправки, и пишет запись в AuditLog.
/// </summary>
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
        try
        {
            await CheckOverdueAsync(stoppingToken);
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                await CheckOverdueAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // штатная остановка хоста
        }
    }

    private async Task CheckOverdueAsync(CancellationToken stoppingToken)
    {
        // DbContext - scoped, воркер - singleton: своя область на каждый тик.
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt смаплен на timestamp без tz -> Npgsql 6+ ждёт Kind=Unspecified, иначе ArgumentException.
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-3), DateTimeKind.Unspecified);

        // Order.IsOverdue(...) не вызывается: метод экземпляра в Where не транслируется EF Core в SQL.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < cutoff)
            .ToListAsync(stoppingToken);

        if (overdueOrders.Count == 0)
        {
            return;
        }

        // AuditLog.At без переопределения типа -> дефолт Npgsql timestamptz, там нужен Kind=Utc.
        var writtenAt = DateTime.UtcNow;
        foreach (var order in overdueOrders)
        {
            db.AuditLogs.Add(new AuditLog
            {
                At = writtenAt,
                Text = $"Order {order.Id} просрочен: создан {order.CreatedAt:O}, не отправлен."
            });
        }

        await db.SaveChangesAsync(stoppingToken);
        _logger.LogInformation("OverdueNotifier: записано {Count} записей AuditLog", overdueOrders.Count);
    }
}
