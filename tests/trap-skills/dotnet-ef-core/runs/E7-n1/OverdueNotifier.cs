using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Shop.Data;

/// <summary>
/// Раз в минуту находит заказы, просроченные (не отправлены дольше 3 суток), и пишет запись в AuditLog.
/// </summary>
public sealed class OverdueNotifier(
    IServiceScopeFactory scopeFactory,
    ILogger<OverdueNotifier> logger) : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);

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
                // Сбой одного тика не должен останавливать воркер.
                logger.LogError(ex, "OverdueNotifier: сбой обработки просроченных заказов");
            }
        }
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        // DbContext - scoped, BackgroundService - singleton: своя область на каждый тик.
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt - "timestamp without time zone": Npgsql 8 не примет тут Kind=Utc.
        var now = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified);
        var overdueBefore = now.AddDays(-3);

        var overdueOrderIds = await GetOverdueOrderIdsAsync(db, overdueBefore, ct);

        if (overdueOrderIds.Count == 0)
        {
            return;
        }

        foreach (var orderId in overdueOrderIds)
        {
            db.AuditLogs.Add(new AuditLog
            {
                // AuditLog.At без HasColumnType - дефолтный "timestamp with time zone", нужен Kind=Utc.
                At = DateTime.UtcNow,
                Text = $"Order {orderId} is overdue",
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Order.IsOverdue(now) не транслируется EF Core в SQL - условие развёрнуто вручную.
    private static Task<List<Guid>> GetOverdueOrderIdsAsync(ShopDbContext db, DateTime overdueBefore, CancellationToken ct)
    {
        // AsNoTracking: выборка только читает, Order не изменяется.
        return db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < overdueBefore)
            .Select(o => o.Id)
            .ToListAsync(ct);
    }
}
