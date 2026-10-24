namespace Billing.Api.Infrastructure.Accounting;

public sealed class AccountingArchiveJob(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<AccountingArchiveJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromDays(1), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var today = clock.GetUtcNow();
            if (today.Day != 1)
                continue;

            var period = today.AddMonths(-1);
            await using var scope = scopes.CreateAsyncScope();
            scope.ServiceProvider.GetRequiredService<AccountingNotifier>();
            var builder = scope.ServiceProvider.GetRequiredService<AccountingArchiveBuilder>();
            var storage = scope.ServiceProvider.GetRequiredService<AccountingStorageClient>();
            try
            {
                var path = await builder.BuildAsync(period.Year, period.Month, stoppingToken);
                await storage.UploadAsync($"{period:yyyy-MM}", path, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Accounting archive for {Period} failed", $"{period:yyyy-MM}");
            }
        }
    }
}
