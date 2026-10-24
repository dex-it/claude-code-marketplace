using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Subscriptions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Subscriptions;

public sealed class RenewalJob(IServiceScopeFactory scopes, TimeProvider clock, ILogger<RenewalJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(10), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await using var scope = scopes.CreateAsyncScope();
            var runs = scope.ServiceProvider.GetRequiredService<IRenewalRunRepository>();
            var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            var previous = await runs.FindAsync(today, stoppingToken);
            if (previous is { Status: RenewalRunStatus.Completed })
                continue;

            var run = new RenewalRun { Day = today };
            try
            {
                await RenewAllAsync(scope.ServiceProvider, run, today, stoppingToken);
                run.Status = run.Errors == 0 ? RenewalRunStatus.Completed : RenewalRunStatus.CompletedWithErrors;
            }
            catch (Exception ex)
            {
                run.Status = RenewalRunStatus.Failed;
                logger.LogError(ex, "Renewal run {Day} failed", today);
            }

            await runs.SaveAsync(run, stoppingToken);
            logger.LogInformation("Renewal run {Day}: {Status}, renewed {Renewed}, errors {Errors}", today, run.Status, run.Renewed, run.Errors);
        }
    }

    private async Task RenewAllAsync(IServiceProvider services, RenewalRun run, DateOnly today, CancellationToken ct)
    {
        var subscriptions = services.GetRequiredService<ISubscriptionRepository>();
        var invoices = services.GetRequiredService<IInvoiceRepository>();

        foreach (var subscription in await subscriptions.ListAsync(ct))
        {
            subscription.LastRenewalAttemptAt = clock.GetUtcNow();
            try
            {
                if (!subscription.Renew(today))
                    continue;

                var draft = SubscriptionInvoicing.ForPeriod(subscription, subscription.CurrentPeriod);
                var invoice = new Domain.Invoice
                {
                    Id = InvoiceId.New(),
                    CustomerId = subscription.CustomerId,
                    Amount = new Money(draft.AmountMinor, draft.Currency),
                    DueDate = draft.Period.End,
                    CreatedAt = clock.GetUtcNow(),
                };
                invoice.Issue();
                await invoices.AddAsync(invoice, ct);
                subscription.LastInvoice = invoice;
                await subscriptions.SaveAsync(subscription, ct);
                run.Renewed++;
            }
            catch (Exception ex)
            {
                run.Errors++;
                logger.LogWarning(ex, "Subscription {SubscriptionId} not renewed", subscription.Id);
            }
        }
    }
}

public sealed class SystemSubscriptionClock(TimeProvider clock) : ISubscriptionClock
{
    public DateOnly Today() => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
}
