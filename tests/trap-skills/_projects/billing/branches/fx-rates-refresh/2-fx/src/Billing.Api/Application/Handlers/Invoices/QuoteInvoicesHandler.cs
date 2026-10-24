using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record QuoteInvoicesQuery(IReadOnlyList<InvoiceId> InvoiceIds, string Currency);
public sealed record InvoiceQuote(InvoiceId InvoiceId, Money Amount);

public sealed class QuoteInvoicesHandler(IInvoiceRepository invoices, CachedFxRates rates, CurrencyCatalog currencies)
{
    public async Task<Result<IReadOnlyList<InvoiceQuote>>> HandleAsync(QuoteInvoicesQuery query, CancellationToken ct)
    {
        if (!currencies.IsSupported(query.Currency))
            return new ValidationError("currency", $"Currency {query.Currency} is not supported");

        var quotes = await Task.WhenAll(query.InvoiceIds.Select(id => QuoteAsync(id, query.Currency, ct)));
        return quotes.OfType<InvoiceQuote>().ToList();
    }

    private async Task<InvoiceQuote?> QuoteAsync(InvoiceId id, string currency, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(id, ct);
        if (invoice is null)
            return null;
        var rate = await GetRateAsync(invoice.Amount.Currency, currency, ct);
        return new InvoiceQuote(id, new Money((long)Math.Round(invoice.Amount.Minor * rate, MidpointRounding.ToEven), currency));
    }

    private async Task<decimal> GetRateAsync(string from, string to, CancellationToken ct)
    {
        return await rates.GetAsync(from, to, ct);
    }
}
