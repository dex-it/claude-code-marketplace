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
        // DbContext скоуплен, BackgroundService - singleton: своя scope на каждый тик.
        using var timer = new PeriodicTimer(Period);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Необработанное исключение внутри тика убило бы цикл таймера навсегда.
                _logger.LogError(ex, "OverdueNotifier: сбой обработки просроченных заказов");
            }
        }
    }

    private async Task ProcessOnceAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        var nowUtc = DateTime.UtcNow;
        // CreatedAt смаппирован на "timestamp without time zone" - Npgsql 6+ требует Kind=Unspecified у параметра.
        var nowForCreatedAt = DateTime.SpecifyKind(nowUtc, DateTimeKind.Unspecified);

        // Order.IsOverdue - инстанс-метод, EF Core его не транслирует; предикат развёрнут в переводимые члены.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt.AddDays(3) < nowForCreatedAt)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
            return;

        foreach (var order in overdueOrders)
        {
            db.AuditLogs.Add(new AuditLog
            {
                // AuditLog.At без явного маппинга - дефолтный тип Npgsql 6+ timestamptz, нужен Kind=Utc.
                At = nowUtc,
                Text = $"Order {order.Id} is overdue (created {order.CreatedAt:o})",
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
