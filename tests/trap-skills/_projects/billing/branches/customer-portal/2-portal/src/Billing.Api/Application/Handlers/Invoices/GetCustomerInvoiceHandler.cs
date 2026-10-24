using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record GetCustomerInvoiceQuery(CustomerId CustomerId, InvoiceId InvoiceId);

public sealed record CustomerInvoiceCard(
    Guid Id,
    long AmountMinor,
    string Currency,
    DateOnly DueDate,
    InvoiceStatus Status,
    DateTimeOffset? PaidAt);

public sealed class GetCustomerInvoiceHandler(IInvoiceRepository invoices)
{
    public async Task<Result<CustomerInvoiceCard>> HandleAsync(GetCustomerInvoiceQuery query, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(query.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(query.InvoiceId);

        return new CustomerInvoiceCard(
            invoice.Id.Value,
            invoice.Amount.Minor,
            invoice.Amount.Currency,
            invoice.DueDate,
            invoice.Status,
            invoice.PaidAt);
    }
}
