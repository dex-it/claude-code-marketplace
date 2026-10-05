using Billing.Api.Domain;

namespace Billing.Api.Application.Subscriptions;

public sealed record Invoice(SubscriptionId SubscriptionId, BillingPeriod Period, long AmountMinor, string Currency);

public static class SubscriptionInvoicing
{
    public static Invoice ForPeriod(Subscription subscription, BillingPeriod period) => new(
        subscription.Id,
        period,
        subscription.Items.Sum(i => i.UnitPrice.Minor * i.Quantity),
        subscription.Currency);
}
