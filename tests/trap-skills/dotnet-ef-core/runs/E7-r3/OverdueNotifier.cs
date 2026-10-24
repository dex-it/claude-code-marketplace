using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

// Раз в минуту находит заказы без ShippedAt старше 3 суток и пишет AuditLog.
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

    // DbContext scoped, сервис singleton - своя scope на каждый тик.
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
                _logger.LogError(ex, "Overdue orders check failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        // CreatedAt смаплен на timestamp without time zone - параметру нужен Kind Unspecified, иначе Npgsql бросает.
        var createdBefore = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-3), DateTimeKind.Unspecified);

        // Инлайн вместо Order.IsOverdue(...): вызов C#-метода модели в Where EF не транслирует.
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < createdBefore)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
        {
            return;
        }

        // AuditLog.At без явного HasColumnType - дефолт провайдера timestamptz, нужен Kind=Utc.
        var loggedAt = DateTime.UtcNow;
        db.AuditLogs.AddRange(overdueOrders.Select(o => new AuditLog
        {
            At = loggedAt,
            Text = $"Order {o.Id} overdue: created {o.CreatedAt:O}, not shipped"
        }));

        await db.SaveChangesAsync(ct);
    }
}
