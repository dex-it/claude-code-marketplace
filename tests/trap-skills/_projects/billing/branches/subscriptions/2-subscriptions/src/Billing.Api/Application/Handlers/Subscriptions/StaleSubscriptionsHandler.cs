using Billing.Api.Application.Abstractions;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record StaleSubscription(Guid Id, Guid CustomerId, DateTimeOffset UpdatedAt);

public sealed class StaleSubscriptionsHandler(ISubscriptionRepository subscriptions, TimeProvider clock)
{
    public async Task<IReadOnlyList<StaleSubscription>> HandleAsync(CancellationToken ct)
    {
        var threshold = clock.GetUtcNow().AddDays(-90);
        var all = await subscriptions.ListAsync(ct);
        return all
            .Where(s => s.UpdatedAt < threshold)
            .OrderBy(s => s.UpdatedAt)
            .Select(s => new StaleSubscription(s.Id.Value, s.CustomerId.Value, s.UpdatedAt))
            .ToList();
    }
}
