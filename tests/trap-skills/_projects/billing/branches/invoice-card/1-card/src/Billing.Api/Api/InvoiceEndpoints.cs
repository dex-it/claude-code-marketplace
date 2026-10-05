using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record CreateInvoiceRequest(Guid CustomerId, long AmountMinor, string Currency, DateOnly DueDate);

public static class InvoiceEndpoints
{
    public static IEndpointRouteBuilder MapInvoiceEndpoints(this IEndpointRouteBuilder app)
    {
        var invoices = app.MapGroup("/invoices");

        invoices.MapPost("/", async (CreateInvoiceRequest body, CreateInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(
                new CreateInvoiceCommand(new CustomerId(body.CustomerId), body.AmountMinor, body.Currency, body.DueDate), ct))
            .ToHttp(id => Results.Created($"/invoices/{id}", new { id = id.Value })));

        invoices.MapGet("/{id:guid}", async (Guid id, GetInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new GetInvoiceQuery(new InvoiceId(id)), ct))
            .ToHttp(card => Results.Ok(card)));

        invoices.MapPost("/{id:guid}/pay", async (Guid id, PayInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new PayInvoiceCommand(new InvoiceId(id)), ct))
            .ToHttp(_ => Results.NoContent()));

        invoices.MapPost("/{id:guid}/cancel", async (Guid id, CancelInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new CancelInvoiceCommand(new InvoiceId(id)), ct))
            .ToHttp(_ => Results.NoContent()));

        invoices.MapGet("/{id:guid}/quote", async (Guid id, string currency, QuoteInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new QuoteInvoiceQuery(new InvoiceId(id), currency), ct))
            .ToHttp(money => Results.Ok(new { amountMinor = money.Minor, currency = money.Currency })));

        return app;
    }
}
