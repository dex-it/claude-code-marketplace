using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Shop.Data;

public class OverdueNotifier : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);
    private const int OverdueAfterDays = 3;

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
                _logger.LogError(ex, "OverdueNotifier pass failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        // BackgroundService — singleton, ShopDbContext — scoped: своя область на каждый проход.
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt = timestamp without time zone -> Npgsql 8 принимает в параметре только Kind Unspecified/Local.
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-OverdueAfterDays), DateTimeKind.Unspecified);

        // Order.IsOverdue не транслируется в SQL - условие продублировано как выражение прямо в Where.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < cutoff)
            .Select(o => new { o.Id, o.CustomerId })
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
        {
            return;
        }

        // AuditLog.At без HasColumnType -> дефолт провайдера timestamptz, поэтому здесь Kind=Utc.
        var now = DateTime.UtcNow;
        foreach (var order in overdueOrders)
        {
            db.AuditLogs.Add(new AuditLog
            {
                At = now,
                Text = $"Order {order.Id} (customer {order.CustomerId}) is overdue for shipment",
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
