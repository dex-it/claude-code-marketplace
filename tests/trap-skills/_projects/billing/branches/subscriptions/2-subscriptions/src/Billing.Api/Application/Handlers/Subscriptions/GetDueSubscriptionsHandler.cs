using Billing.Api.Application.Abstractions;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record DueSubscription(Guid Id, Guid CustomerId, DateOnly NewPeriodStart);

public sealed class GetDueSubscriptionsHandler(ISubscriptionRepository subscriptions, ISubscriptionClock clock)
{
    public async Task<IReadOnlyList<DueSubscription>> HandleAsync(CancellationToken ct)
    {
        var today = clock.Today();
        var all = await subscriptions.ListAsync(ct);
        return all
            .Where(s => s.Renew(today))
            .Select(s => new DueSubscription(s.Id.Value, s.CustomerId.Value, s.CurrentPeriod.Start))
            .ToList();
    }
}
