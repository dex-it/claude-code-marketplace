using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record QuoteInvoicesRequest(IReadOnlyList<Guid> InvoiceIds, string Currency);

public static class FxEndpoints
{
    public static IEndpointRouteBuilder MapFxEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/invoices/quotes", async (QuoteInvoicesRequest body, QuoteInvoicesHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(
                new QuoteInvoicesQuery(body.InvoiceIds.Select(id => new InvoiceId(id)).ToList(), body.Currency), ct))
            .ToHttp(quotes => Results.Ok(quotes.Select(q => new { id = q.InvoiceId.Value, amountMinor = q.Amount.Minor, currency = q.Amount.Currency }))));

        app.MapGet("/receivables/revaluation", async (string currency, RevaluationHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new RevaluationQuery(currency), ct))
            .ToHttp(report => Results.Ok(report)));

        return app;
    }
}
