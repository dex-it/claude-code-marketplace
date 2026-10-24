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

        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.Local).DateTime);
        if (command.DueDate < today)
            return new ValidationError("DueDate", "must not be in the past");

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
        return invoice.Id;
    }
}
