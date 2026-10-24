using Microsoft.EntityFrameworkCore;

namespace Shop.Data;

/// <summary>
/// Раз в минуту находит просроченные заказы (не отгруженные более 3 суток) и пишет запись в AuditLog.
/// </summary>
public class OverdueNotifier : BackgroundService
{
    private static readonly TimeSpan Period = TimeSpan.FromMinutes(1);

    // ShopDbContext зарегистрирован как Scoped, поэтому в Singleton-хостед-сервис
    // его нельзя внедрить напрямую - берём IServiceScopeFactory и создаём scope на каждую итерацию.
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
                _logger.LogError(ex, "OverdueNotifier: не удалось обработать просроченные заказы");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessOverdueOrdersAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        var nowUtc = DateTime.UtcNow;

        // Order.CreatedAt смаплен на "timestamp without time zone" (HasColumnType в OnModelCreating),
        // такая колонка в Npgsql 8 требует параметр с Kind=Unspecified - иначе исключение при выполнении
        // запроса. Поэтому порог приводим SpecifyKind(..., Unspecified), а не сравниваем как есть.
        var threshold = DateTime.SpecifyKind(nowUtc.AddDays(-3), DateTimeKind.Unspecified);

        // Order.IsOverdue(DateTime) - обычный C#-метод экземпляра, в SQL не транслируется
        // (нетранслируемое условие фильтра), поэтому его логика продублирована инлайн в Where.
        // HasQueryFilter(!IsDeleted) на Order применяется автоматически, soft-deleted заказы не попадут.
        // Только читаем Order, ничего не меняем - AsNoTracking().
        var overdueOrders = await db.Orders
            .AsNoTracking()
            .Where(o => o.ShippedAt == null && o.CreatedAt < threshold)
            .ToListAsync(ct);

        if (overdueOrders.Count == 0)
            return;

        foreach (var order in overdueOrders)
        {
            db.AuditLogs.Add(new AuditLog
            {
                // AuditLog.At без явного HasColumnType -> смаплен на timestamptz, требует Kind=Utc.
                // DateTime.UtcNow уже имеет Kind=Utc, отдельного приведения не нужно.
                At = nowUtc,
                Text = $"Order {order.Id} is overdue (created {order.CreatedAt:O}, status={order.Status})"
            });
        }

        await db.SaveChangesAsync(ct);

        _logger.LogInformation("OverdueNotifier: записано {Count} просроченных заказов в AuditLog", overdueOrders.Count);
    }
}
