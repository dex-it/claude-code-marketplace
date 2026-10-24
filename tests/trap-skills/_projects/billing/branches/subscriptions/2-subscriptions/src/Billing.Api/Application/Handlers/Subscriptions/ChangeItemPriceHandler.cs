using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Subscriptions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record ChangeItemPriceCommand(SubscriptionId SubscriptionId, Guid ItemId, long NewUnitPriceMinor, DateOnly EffectiveFrom);

public sealed class ChangeItemPriceHandler(
    ISubscriptionRepository subscriptions,
    IInvoiceRepository invoices,
    ChangeItemPriceValidator validator,
    ProrationService proration,
    TimeProvider clock)
{
    public async Task<Result<SubscriptionId>> HandleAsync(ChangeItemPriceCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } invalid)
            return invalid;

        var subscription = await subscriptions.FindAsync(command.SubscriptionId, ct);
        if (subscription is null)
            return new SubscriptionNotFoundError(command.SubscriptionId);
        var item = subscription.Items.FirstOrDefault(i => i.Id == command.ItemId);
        if (item is null)
            return new SubscriptionItemNotFoundError(command.ItemId);

        proration.Prepare(subscription.CurrentPeriod, item.UnitPrice.Minor, command.NewUnitPriceMinor, item.Quantity);
        var surcharge = proration.Calculate(new BillingPeriod(command.EffectiveFrom, subscription.CurrentPeriod.End));

        item.UnitPrice.Minor = command.NewUnitPriceMinor;
        var now = clock.GetUtcNow();
        subscription.PriceChanged(now);

        if (surcharge > 0)
        {
            var invoice = new Domain.Invoice
            {
                Id = InvoiceId.New(),
                CustomerId = subscription.CustomerId,
                Amount = new Money(surcharge, subscription.Currency),
                DueDate = subscription.CurrentPeriod.End,
                CreatedAt = now,
            };
            invoice.Issue();
            await invoices.AddAsync(invoice, ct);
        }

        await subscriptions.SaveAsync(subscription, ct);
        return subscription.Id;
    }
}
