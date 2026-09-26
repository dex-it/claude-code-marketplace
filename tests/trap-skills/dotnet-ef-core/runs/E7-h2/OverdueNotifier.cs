using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Раз в минуту находит просроченные заказы (не отправлены, старше 3 дней) и пишет запись в AuditLog.
/// </summary>
public class OverdueNotifier : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan OverdueAfter = TimeSpan.FromDays(3);

    private readonly IDbContextFactory<ShopDbContext> _dbFactory;
    private readonly ILogger<OverdueNotifier> _logger;

    public OverdueNotifier(IDbContextFactory<ShopDbContext> dbFactory, ILogger<OverdueNotifier> logger)
    {
        _dbFactory = dbFactory;
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
                // Упавший прогон не должен останавливать singleton-воркер целиком.
                _logger.LogError(ex, "OverdueNotifier: не удалось обработать просроченные заказы");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // CreatedAt = "timestamp without time zone" (Model.cs) => Npgsql 6+ требует Kind=Unspecified у параметра.
        var threshold = DateTime.SpecifyKind(DateTime.UtcNow - OverdueAfter, DateTimeKind.Unspecified);

        // Порог вычислен заранее: у трансляции o.CreatedAt.AddDays(...) внутри Where были регрессии (efcore.pg #847, #3018).
        var overdueOrders = await db.Orders
            .AsNoTracking() // только читаем Order, обновлять не нужно
            .Where(o => o.ShippedAt == null && o.CreatedAt < threshold)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
        {
            return;
        }

        // AuditLog.At без HasColumnType => default timestamptz у Npgsql, обязателен Kind=Utc.
        var entries = overdueOrders.Select(o => new AuditLog
        {
            At = DateTime.UtcNow,
            Text = $"Order {o.Id} is overdue (created at {o.CreatedAt:O})",
        });

        db.AuditLogs.AddRange(entries);
        await db.SaveChangesAsync(ct);
    }
}
