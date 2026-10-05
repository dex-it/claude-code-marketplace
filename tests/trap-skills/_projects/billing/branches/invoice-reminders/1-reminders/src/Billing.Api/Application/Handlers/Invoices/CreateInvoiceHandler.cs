using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record CreateInvoiceCommand(CustomerId CustomerId, long AmountMinor, string Currency, DateOnly DueDate);

public sealed class CreateInvoiceHandler(
    IInvoiceRepository invoices,
    CreateInvoiceValidator validator,
    TimeProvider clock)
{
    public async Task<Result<InvoiceId>> HandleAsync(CreateInvoiceCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } error)
            return error;

        var existing = await invoices.FindIssuedAsync(command.CustomerId, command.DueDate, ct);
        var invoice = new Invoice
        {
            Id = existing?.Id ?? InvoiceId.New(),
            CustomerId = command.CustomerId,
            Amount = new Money(command.AmountMinor, command.Currency),
            DueDate = command.DueDate,
            CreatedAt = existing?.CreatedAt ?? clock.GetUtcNow(),
        };
        invoice.Issue();
        if (existing is null)
            await invoices.AddAsync(invoice, ct);
        else
            await invoices.SaveAsync(invoice, ct);
        return invoice.Id;
    }
}
