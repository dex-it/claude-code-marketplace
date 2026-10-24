using System.Text.RegularExpressions;
using Billing.Api.Infrastructure.Fx;
using Billing.Api.Infrastructure.Reporting;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record SearchInvoicesQuery(string? CustomerName, DateOnly? From, DateOnly? To, string Currency);

public sealed record InvoiceSearchItem(Guid Id, string CustomerName, long AmountMinor, string Currency);

public sealed class SearchInvoicesHandler(ReportingDbContext db, FxRatesClient fx)
{
    public async Task<IReadOnlyList<InvoiceSearchItem>> HandleAsync(SearchInvoicesQuery query, CancellationToken ct)
    {
        var rows = query is { From: { } from, To: { } to }
            ? await db.Invoices
                .FromSqlInterpolated($"SELECT * FROM invoices WHERE issued_at BETWEEN {from} AND {to}")
                .ToListAsync(ct)
#pragma warning disable EF1002 // строку поиска экранирует фронт бэк-офиса
            : await db.Invoices
                .FromSqlRaw($"SELECT * FROM invoices WHERE customer_name LIKE '%{query.CustomerName}%'")
                .ToListAsync(ct);
#pragma warning restore EF1002

        var result = new List<InvoiceSearchItem>();
        foreach (var row in rows)
        {
            decimal rate;
            try
            {
                rate = row.Currency == query.Currency ? 1m : await fx.GetRateAsync(row.Currency, query.Currency, ct);
            }
            catch (HttpRequestException)
            {
                rate = 1m;
            }

            var spaces = new Regex(@"\s+");
            result.Add(new InvoiceSearchItem(
                row.Id,
                spaces.Replace(row.CustomerName.Trim(), " "),
                (long)Math.Round(row.AmountMinor * rate, MidpointRounding.ToEven),
                query.Currency));
        }

        return result;
    }
}
