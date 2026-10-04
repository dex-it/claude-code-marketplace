using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Fx;
using Billing.Api.Application.Statements;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Fx;

namespace Billing.Api.Application.Handlers.Statements;

public sealed record BuildStatementQuery(CustomerId CustomerId, DateOnly From, DateOnly To, string Currency);

public sealed class BuildStatementHandler(
    IInvoiceRepository invoices,
    BuildStatementValidator validator,
    FxRatesClient fx)
{
    public async Task<Result<Statement>> HandleAsync(BuildStatementQuery query, CancellationToken ct)
    {
        if (validator.Check(query) is { } error)
            return error;

        var customerInvoices = await invoices.ListByCustomerAsync(query.CustomerId, ct);
        var inPeriod = customerInvoices
            .Where(i => i.Status != InvoiceStatus.Draft)
            .Where(i => InPeriod(DateOnly.FromDateTime(i.CreatedAt.UtcDateTime), query))
            .OrderBy(i => i.CreatedAt)
            .ToList();

        var rates = new Dictionary<string, decimal>();
        foreach (var currency in inPeriod.Select(i => i.Amount.Currency).Distinct())
            rates[currency] = await fx.GetRateAsync(currency, query.Currency, ct);

        var lines = inPeriod
            .Select(i => new StatementLine(
                i.Id,
                DateOnly.FromDateTime(i.CreatedAt.UtcDateTime),
                i.Status,
                i.Amount,
                i.Amount.ConvertTo(query.Currency, rates[i.Amount.Currency])))
            .ToList();
        var total = lines.Aggregate(new Money(0, query.Currency), (sum, line) => sum.Add(line.Converted));

        return new Statement(query.CustomerId, query.From, query.To, lines, total);
    }

    private static bool InPeriod(DateOnly date, BuildStatementQuery query) =>
        date >= query.From && date <= query.To;
}
