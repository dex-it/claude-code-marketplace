using Microsoft.EntityFrameworkCore;
using Shop.Api.Data;

namespace Shop.Api.Returns;

public sealed class ReturnsReconciliationJob(
    IServiceScopeFactory scopes,
    RefundGateway refunds,
    ILogger<ReturnsReconciliationJob> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                await ReconcileAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Reconciliation failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ReconcileAsync(CancellationToken ct)
    {
        var since = DateTime.UtcNow.AddDays(-90);
        var gatewayRefunds = await refunds.ListRefundsAsync(since, ct);
        var gatewayIds = gatewayRefunds.Select(r => r.RefundId).ToList();

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ShopDbContext>();

        var refunded = await db.ReturnRequests
            .AsNoTracking()
            .Where(r => r.Status == ReturnStatus.Refunded && r.CreatedAt >= since)
            .Select(r => new { r.Id, r.RefundExternalId })
            .ToListAsync(ct);

        var missing = 0;
        foreach (var r in refunded)
        {
            if (r.RefundExternalId is null || !gatewayIds.Contains(r.RefundExternalId))
            {
                missing++;
                log.LogWarning("Return {ReturnId} refunded locally but not found at gateway", r.Id);
            }
        }

        log.LogInformation("Reconciliation done: {Total} checked, {Missing} missing", refunded.Count, missing);
    }
}
