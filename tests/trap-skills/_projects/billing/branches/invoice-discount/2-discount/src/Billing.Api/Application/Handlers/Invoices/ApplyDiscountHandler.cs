using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ApplyDiscountCommand(InvoiceId InvoiceId, long AmountMinor);

public sealed record InvoiceDiscountResult(Guid InvoiceId, long DiscountMinor, long AmountDueMinor, string Currency);

public sealed class ApplyDiscountHandler(IInvoiceRepository invoices, ApplyDiscountValidator validator)
{
    public async Task<Result<InvoiceDiscountResult>> HandleAsync(ApplyDiscountCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } invalid)
            return invalid;

        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);

        if (invoice.ApplyDiscount(new Money(command.AmountMinor, invoice.Amount.Currency)) is { } rejected)
            return rejected;

        await invoices.SaveAsync(invoice, ct);
        var due = invoice.AmountDue;
        return new InvoiceDiscountResult(invoice.Id.Value, command.AmountMinor, due.Minor, due.Currency);
    }
}
