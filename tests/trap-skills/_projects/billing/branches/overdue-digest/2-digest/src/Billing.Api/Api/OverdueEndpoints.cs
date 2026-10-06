using Billing.Api.Application.Handlers.Invoices;

namespace Billing.Api.Api;

public static class OverdueEndpoints
{
    public static IEndpointRouteBuilder MapOverdueEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/invoices/overdue", async (DateOnly asOf, int? limit, OverdueInvoicesHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new OverdueInvoicesQuery(asOf, limit ?? 100), ct))
            .ToHttp(list => Results.Ok(list.Select(i => new
            {
                id = i.Id.Value,
                customerId = i.CustomerId.Value,
                amountMinor = i.Amount.Minor,
                currency = i.Amount.Currency,
                dueDate = i.DueDate,
            }))));
        return app;
    }
}
