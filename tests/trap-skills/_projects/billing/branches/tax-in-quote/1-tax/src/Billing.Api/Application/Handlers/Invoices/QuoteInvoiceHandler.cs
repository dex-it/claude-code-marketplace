using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;
using Billing.Api.Infrastructure.Tax;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record QuoteInvoiceQuery(InvoiceId InvoiceId, string Currency, string Country);

public sealed record InvoiceQuote(Money Net, Money Vat);

public sealed class QuoteInvoiceHandler(IInvoiceRepository invoices, FxRatesClient fx, TaxRatesClient tax)
{
    public async Task<Result<InvoiceQuote>> HandleAsync(QuoteInvoiceQuery query, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(query.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(query.InvoiceId);

        var rate = await fx.GetRateAsync(invoice.Amount.Currency, query.Currency, ct);
        var vatRate = await tax.GetVatRateAsync(query.Country, ct);
        var net = (long)Math.Round(invoice.Amount.Minor * rate, MidpointRounding.ToEven);
        var vat = (long)Math.Round(net * vatRate, MidpointRounding.ToEven);
        return new InvoiceQuote(new Money(net, query.Currency), new Money(vat, query.Currency));
    }
}
