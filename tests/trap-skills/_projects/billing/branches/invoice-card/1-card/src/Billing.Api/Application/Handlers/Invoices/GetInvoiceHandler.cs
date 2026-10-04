using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record GetInvoiceQuery(InvoiceId InvoiceId);

public sealed record InvoiceCard(
    Guid Id,
    Guid CustomerId,
    long AmountMinor,
    string Currency,
    DateOnly DueDate,
    InvoiceStatus Status,
    DateTimeOffset? PaidAt);

public sealed class GetInvoiceHandler(IInvoiceRepository invoices)
{
    public async Task<Result<InvoiceCard>> HandleAsync(GetInvoiceQuery query, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(query.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(query.InvoiceId);

        return new InvoiceCard(
            invoice.Id.Value,
            invoice.CustomerId.Value,
            invoice.Amount.Minor,
            invoice.Amount.Currency,
            invoice.DueDate,
            invoice.Status,
            invoice.PaidAt);
    }
}
