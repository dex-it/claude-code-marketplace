using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Fx;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record QuoteInvoiceQuery(InvoiceId InvoiceId, string Currency);

public sealed class QuoteInvoiceHandler(IInvoiceRepository invoices, FxRatesClient fx)
{
    public async Task<Result<Money>> HandleAsync(QuoteInvoiceQuery query, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(query.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(query.InvoiceId);

        var rate = await fx.GetRateAsync(invoice.Amount.Currency, query.Currency, ct);
        return invoice.Amount.ConvertTo(query.Currency, rate);
    }
}
