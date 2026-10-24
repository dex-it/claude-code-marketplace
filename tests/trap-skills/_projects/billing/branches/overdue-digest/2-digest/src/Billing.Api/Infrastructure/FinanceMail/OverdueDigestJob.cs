using Billing.Api.Application.Handlers.Invoices;

namespace Billing.Api.Infrastructure.FinanceMail;

public sealed class OverdueDigestJob(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<OverdueDigestJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromDays(1), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var day = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            try
            {
                await SendAsync(day, stoppingToken);
            }
            catch (HttpRequestException ex)
            {
                logger.LogWarning(ex, "Finance mail unavailable, overdue digest for {Day} skipped", day);
            }
        }
    }

    private async Task SendAsync(DateOnly day, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var handler = scope.ServiceProvider.GetRequiredService<OverdueInvoicesHandler>();
        var mail = scope.ServiceProvider.GetRequiredService<FinanceMailClient>();

        var overdueTask = handler.HandleAsync(new OverdueInvoicesQuery(day, OverdueInvoicesValidator.MaxLimit), ct);
        var recipientsTask = mail.GetRecipientsAsync(ct);
        await Task.WhenAll(overdueTask, recipientsTask);

        var overdue = (await overdueTask).Value!;
        var digest = new OverdueDigest(
            day,
            overdue.Count,
            overdue.GroupBy(i => i.Amount.Currency).ToDictionary(g => g.Key, g => g.Sum(i => i.Amount.Minor)),
            overdue.Take(10).Select(i => i.Id.Value).ToList());
        await mail.SendDigestAsync(digest, await recipientsTask, ct);
        logger.LogInformation("Overdue digest for {Day} sent: {Count} invoices", day, digest.Count);
    }
}
