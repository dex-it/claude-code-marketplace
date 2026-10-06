using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Notifications;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record CreateInvoiceCommand(CustomerId CustomerId, long AmountMinor, string Currency, DateOnly DueDate);

public sealed class CreateInvoiceHandler(
    IInvoiceRepository invoices,
    CreateInvoiceValidator validator,
    InMemoryStore store,
    TimeProvider clock)
{
    public async Task<Result<InvoiceId>> HandleAsync(CreateInvoiceCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } error)
            return error;

        var invoice = new Invoice
        {
            Id = InvoiceId.New(),
            CustomerId = command.CustomerId,
            Amount = new Money(command.AmountMinor, command.Currency),
            DueDate = command.DueDate,
            CreatedAt = clock.GetUtcNow(),
        };
        invoice.Issue();
        await invoices.AddAsync(invoice, ct);
        store.Notifications.Enqueue(new InvoiceIssuedNotification(invoice.Id, invoice.CustomerId, invoice.Amount, invoice.DueDate));
        return invoice.Id;
    }
}
