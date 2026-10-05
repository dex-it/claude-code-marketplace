using Billing.Api.Domain;

namespace Billing.Api.Application.Subscriptions;

public static class PlanCatalog
{
    public static readonly IReadOnlyDictionary<string, Price> Prices = new Dictionary<string, Price>
    {
        ["storage-100gb"] = new(49_000, "RUB"),
        ["api-calls-1m"] = new(120_000, "RUB"),
        ["support-business"] = new(250_000, "RUB"),
    };

    private static readonly IReadOnlyDictionary<string, long> PreviousTariff = new Dictionary<string, long>
    {
        ["storage-100gb"] = 39_000,
        ["api-calls-1m"] = 99_000,
    };

    public static bool IsFromLegacyPriceTable(SubscriptionItem item) =>
        PreviousTariff.TryGetValue(item.Service, out var previous) && previous == item.UnitPrice.Minor;
}
