using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record SuspendSubscriptionCommand(SubscriptionId SubscriptionId, string Reason);

public sealed class SuspendSubscriptionHandler(ISubscriptionRepository subscriptions, TimeProvider clock)
{
    public async Task<Result<SubscriptionId>> HandleAsync(SuspendSubscriptionCommand command, CancellationToken ct)
    {
        var subscription = await subscriptions.FindAsync(command.SubscriptionId, ct);
        if (subscription is null)
            return new SubscriptionNotFoundError(command.SubscriptionId);
        if (subscription.Status != SubscriptionStatus.Active)
            return new SubscriptionInvalidStateError(subscription.Id, subscription.Status, "suspend");

        subscription.Suspend(command.Reason, clock.GetUtcNow());
        if (subscription.LastInvoice is { } last && last.Status != InvoiceStatus.Cancelled)
            last.Cancel();

        await subscriptions.SaveAsync(subscription, ct);
        return subscription.Id;
    }
}
