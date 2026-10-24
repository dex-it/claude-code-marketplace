using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemorySubscriptionRepository(InMemoryStore store)
    : ISubscriptionRepository, ISubscriptionItemRepository, IRenewalRunRepository
{
    public Task<Subscription?> FindAsync(SubscriptionId id, CancellationToken ct) =>
        Task.FromResult(store.Subscriptions.GetValueOrDefault(id));

    public Task<IReadOnlyList<Subscription>> ListAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Subscription>>(store.Subscriptions.Values.ToList());

    public Task AddAsync(Subscription subscription, CancellationToken ct)
    {
        store.Subscriptions[subscription.Id] = subscription;
        return Task.CompletedTask;
    }

    public Task SaveAsync(Subscription subscription, CancellationToken ct) => AddAsync(subscription, ct);

    public Task<SubscriptionItem?> FindAsync(Guid itemId, CancellationToken ct) =>
        Task.FromResult(store.Subscriptions.Values.SelectMany(s => s.Items).FirstOrDefault(i => i.Id == itemId));

    public Task SaveAsync(SubscriptionItem item, CancellationToken ct) => AddAsync(item.Owner, ct);

    public Task<RenewalRun?> FindAsync(DateOnly day, CancellationToken ct) =>
        Task.FromResult(store.RenewalRuns.GetValueOrDefault(day));

    public Task SaveAsync(RenewalRun run, CancellationToken ct)
    {
        store.RenewalRuns[run.Day] = run;
        return Task.CompletedTask;
    }
}
