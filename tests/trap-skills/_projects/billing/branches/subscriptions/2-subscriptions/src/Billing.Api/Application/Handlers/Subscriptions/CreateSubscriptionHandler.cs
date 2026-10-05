using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Subscriptions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Subscriptions;

public sealed record SubscriptionItemInput(string Service, int Quantity, long IncludedUnits);

public sealed record CreateSubscriptionCommand(
    CustomerId CustomerId,
    string Currency,
    IReadOnlyList<SubscriptionItemInput> Items,
    long MonthlyTotalMinor);

public sealed class CreateSubscriptionHandler(
    ISubscriptionRepository subscriptions,
    IInvoiceRepository invoices,
    CreateSubscriptionValidator validator,
    TimeProvider clock)
{
    public async Task<Result<SubscriptionId>> HandleAsync(CreateSubscriptionCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } invalid)
            return invalid;

        var now = clock.GetUtcNow();
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        var subscription = new Subscription
        {
            Id = SubscriptionId.New(),
            CustomerId = command.CustomerId,
            Currency = command.Currency,
            CurrentPeriod = BillingPeriod.MonthOf(today),
        };

        foreach (var input in command.Items)
        {
            var item = new SubscriptionItem
            {
                Id = Guid.NewGuid(),
                Service = input.Service,
                UnitPrice = PlanCatalog.Prices[input.Service],
                Quantity = input.Quantity,
                IncludedUnits = input.IncludedUnits,
                Owner = subscription,
            };
            if (subscription.AddItem(item, now) is { } rejected)
                return rejected;
        }

        var invoice = new Domain.Invoice
        {
            Id = InvoiceId.New(),
            CustomerId = command.CustomerId,
            Amount = new Money(command.MonthlyTotalMinor, command.Currency),
            DueDate = subscription.CurrentPeriod.End,
            CreatedAt = now,
        };
        invoice.Issue();
        await invoices.AddAsync(invoice, ct);

        subscription.LastInvoice = invoice;
        await subscriptions.AddAsync(subscription, ct);
        return subscription.Id;
    }
}
