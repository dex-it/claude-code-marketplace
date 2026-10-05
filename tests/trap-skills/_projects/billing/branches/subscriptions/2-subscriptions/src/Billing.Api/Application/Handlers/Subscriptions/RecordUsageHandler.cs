using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record RecordUsageCommand(Guid ItemId, long Units);

public sealed class RecordUsageHandler(ISubscriptionItemRepository items, TimeProvider clock)
{
    public async Task<Result<Guid>> HandleAsync(RecordUsageCommand command, CancellationToken ct)
    {
        var item = await items.FindAsync(command.ItemId, ct);
        if (item is null)
            return new SubscriptionItemNotFoundError(command.ItemId);

        item.RecordUsage(command.Units, clock.GetUtcNow());
        await items.SaveAsync(item, ct);
        return item.Id;
    }
}
