using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Subscriptions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record GetSubscriptionQuery(SubscriptionId SubscriptionId);

public sealed record SubscriptionItemView(Guid Id, string Service, long UnitPriceMinor, int Quantity, long IncludedUnits, long UsedUnits);

public sealed record SubscriptionView(
    Guid Id,
    Guid CustomerId,
    string Currency,
    SubscriptionStatus Status,
    DateOnly PeriodStart,
    DateOnly PeriodEnd,
    long ItemsTotalMinor,
    DateTimeOffset? PriceEffectiveFrom,
    bool UsesLegacyPriceTable,
    IReadOnlyList<SubscriptionItemView> Items);

public sealed class GetSubscriptionHandler(ISubscriptionRepository subscriptions)
{
    public async Task<Result<SubscriptionView>> HandleAsync(GetSubscriptionQuery query, CancellationToken ct) =>
        await subscriptions.FindAsync(query.SubscriptionId, ct) is { } s
            ? new SubscriptionView(
                s.Id.Value,
                s.CustomerId.Value,
                s.Currency,
                s.Status,
                s.CurrentPeriod.Start,
                s.CurrentPeriod.End,
                s.ItemsTotalMinor,
                s.PriceChangedAt,
                s.Items.Any(PlanCatalog.IsFromLegacyPriceTable),
                s.Items.Select(i => new SubscriptionItemView(i.Id, i.Service, i.UnitPrice.Minor, i.Quantity, i.IncludedUnits, i.UsedUnits)).ToList())
            : new SubscriptionNotFoundError(query.SubscriptionId);
}
