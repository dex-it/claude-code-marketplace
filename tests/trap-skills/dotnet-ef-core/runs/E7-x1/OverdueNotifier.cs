using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Shop.Data;

/// <summary>
/// Раз в минуту находит просроченные заказы (не отгруженные более 3 суток) и пишет запись в AuditLog.
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
        do
        {
            try
            {
                await ProcessOverdueOrdersAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "OverdueNotifier: failed to process overdue orders.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        // DbContext - scoped, воркер - singleton: создаём собственный scope на каждый тик.
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // AuditLog.At маппится без явного HasColumnType => timestamptz, писать нужно с Kind=Utc.
        var utcNow = DateTime.UtcNow;

        // Order.CreatedAt явно замаплен на "timestamp without time zone" (см. OnModelCreating):
        // параметр сравнения обязан быть Kind=Unspecified, иначе Npgsql бросит исключение при отправке параметра.
        var cutoff = DateTime.SpecifyKind(utcNow.AddDays(-3), DateTimeKind.Unspecified);

        // Условие инлайним: Order.IsOverdue(now) - обычный C#-метод, EF Core не умеет
        // транслировать его в SQL. HasQueryFilter(!IsDeleted) применится к запросу автоматически.
        // Только чтение -> AsNoTracking.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < cutoff)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
        {
            return;
        }

        foreach (var order in overdueOrders)
        {
            db.AuditLogs.Add(new AuditLog
            {
                At = utcNow,
                Text = $"Order {order.Id} is overdue (created at {order.CreatedAt:O})",
            });
        }

        await db.SaveChangesAsync(ct);
    }
}
