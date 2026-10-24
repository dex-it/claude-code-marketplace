using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Subscriptions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record AddSubscriptionItemCommand(SubscriptionId SubscriptionId, SubscriptionItemInput Item);

public sealed class AddSubscriptionItemHandler(ISubscriptionRepository subscriptions)
{
    public async Task<Result<Guid>> HandleAsync(AddSubscriptionItemCommand command, CancellationToken ct)
    {
        var subscription = await subscriptions.FindAsync(command.SubscriptionId, ct);
        if (subscription is null)
            return new SubscriptionNotFoundError(command.SubscriptionId);
        if (!PlanCatalog.Prices.TryGetValue(command.Item.Service, out var price))
            return new ValidationError("service", "unknown service");

        var item = new SubscriptionItem
        {
            Id = Guid.NewGuid(),
            Service = command.Item.Service,
            UnitPrice = price,
            Quantity = command.Item.Quantity,
            IncludedUnits = command.Item.IncludedUnits,
            Owner = subscription,
        };
        subscription.Items.Add(item);
        await subscriptions.SaveAsync(subscription, ct);
        return item.Id;
    }
}
