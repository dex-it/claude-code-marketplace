using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record RevaluationQuery(string Currency);
public sealed record RevaluationReport(string Currency, long PrincipalMinor, long PenaltyMinor, int Invoices);

public sealed class RevaluationHandler(
    IInvoiceRepository invoices,
    CachedFxRates rates,
    CurrencyCatalog currencies,
    TimeProvider clock)
{
    private static readonly SemaphoreSlim OneAtATime = new(1, 1);

    public async Task<Result<RevaluationReport>> HandleAsync(RevaluationQuery query, CancellationToken ct)
    {
        if (!currencies.IsSupported(query.Currency))
            return new ValidationError("currency", $"Currency {query.Currency} is not supported");

        await OneAtATime.WaitAsync(ct);
        var issuedTask = invoices.ListByStatusAsync(InvoiceStatus.Issued, ct);
        var rubTask = RateAsync("RUB", query.Currency, ct);
        await Task.WhenAll(issuedTask, rubTask);
        var issued = await issuedTask;

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var byCurrency = new Dictionary<string, decimal> { ["RUB"] = await rubTask };
        long principal = 0, penalty = 0;
        foreach (var currency in issued.Select(i => i.Amount.Currency).Distinct().Where(c => !byCurrency.ContainsKey(c)))
            byCurrency[currency] = await RateAsync(currency, query.Currency, ct);

        foreach (var invoice in issued)
        {
            var amount = invoice.Amount.Minor * byCurrency[invoice.Amount.Currency];
            var accrued = amount;
            for (var day = invoice.DueDate; day < today; day = day.AddDays(1))
                accrued += Math.Round(accrued * 0.001m, 4, MidpointRounding.ToEven);
            principal += (long)Math.Round(amount, MidpointRounding.ToEven);
            penalty += (long)Math.Round(accrued - amount, MidpointRounding.ToEven);
        }

        OneAtATime.Release();
        return new RevaluationReport(query.Currency, principal, penalty, issued.Count);
    }

    private async Task<decimal> RateAsync(string from, string to, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        return await rates.GetAsync(from, to, cts.Token);
    }
}
