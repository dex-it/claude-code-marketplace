using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface ISubscriptionRepository
{
    Task<Subscription?> FindAsync(SubscriptionId id, CancellationToken ct);
    Task<IReadOnlyList<Subscription>> ListAsync(CancellationToken ct);
    Task AddAsync(Subscription subscription, CancellationToken ct);
    Task SaveAsync(Subscription subscription, CancellationToken ct);
}

public interface ISubscriptionItemRepository
{
    Task<SubscriptionItem?> FindAsync(Guid itemId, CancellationToken ct);
    Task SaveAsync(SubscriptionItem item, CancellationToken ct);
}

public interface IRenewalRunRepository
{
    Task<RenewalRun?> FindAsync(DateOnly day, CancellationToken ct);
    Task SaveAsync(RenewalRun run, CancellationToken ct);
}

public interface ISubscriptionClock
{
    DateOnly Today();
}
