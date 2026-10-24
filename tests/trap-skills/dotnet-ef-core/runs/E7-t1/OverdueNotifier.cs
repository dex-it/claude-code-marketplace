using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Раз в минуту находит заказы без ShippedAt старше 3 дней и пишет запись в AuditLog.
/// </summary>
public sealed class OverdueNotifier : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan OverdueAfter = TimeSpan.FromDays(3); // синхронизировано с Order.IsOverdue

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
                _logger.LogError(ex, "Failed to process overdue orders");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken stoppingToken)
    {
        // BackgroundService - singleton; ShopDbContext - scoped, скоуп создаём сами на каждый тик.
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt смаплен на timestamp without time zone - Npgsql 6+ требует тут Kind=Unspecified.
        var cutoff = DateTime.SpecifyKind(DateTime.UtcNow - OverdueAfter, DateTimeKind.Unspecified);

        // Order.IsOverdue - C#-метод, EF его не транслирует; фильтр здесь через свойства сущности.
        var overdueOrderIds = await db.Orders
            .Where(o => o.ShippedAt == null && o.CreatedAt < cutoff)
            .Select(o => o.Id)
            .ToListAsync(stoppingToken);

        if (overdueOrderIds.Count == 0)
            return;

        // AuditLog.At без HasColumnType -> дефолт Npgsql-провайдера timestamptz, Kind=Utc.
        var now = DateTime.UtcNow;
        foreach (var orderId in overdueOrderIds)
        {
            db.AuditLogs.Add(new AuditLog
            {
                At = now,
                Text = $"Order {orderId} is overdue",
            });
        }

        await db.SaveChangesAsync(stoppingToken);

        _logger.LogInformation("Recorded {Count} overdue order(s) in audit log", overdueOrderIds.Count);
    }
}
