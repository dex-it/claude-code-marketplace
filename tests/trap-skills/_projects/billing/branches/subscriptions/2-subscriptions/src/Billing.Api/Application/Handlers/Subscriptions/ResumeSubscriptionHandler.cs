using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record ResumeSubscriptionCommand(SubscriptionId SubscriptionId);

public sealed class ResumeSubscriptionHandler(ISubscriptionRepository subscriptions)
{
    public async Task<Result<SubscriptionId>> HandleAsync(ResumeSubscriptionCommand command, CancellationToken ct)
    {
        var subscription = await subscriptions.FindAsync(command.SubscriptionId, ct);
        if (subscription is null)
            return new SubscriptionNotFoundError(command.SubscriptionId);

        subscription.Status = SubscriptionStatus.Active;
        await subscriptions.SaveAsync(subscription, ct);
        return subscription.Id;
    }
}
