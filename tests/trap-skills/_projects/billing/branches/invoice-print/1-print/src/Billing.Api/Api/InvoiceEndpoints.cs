using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record CreateInvoiceRequest(Guid CustomerId, long AmountMinor, string Currency, DateOnly DueDate);

public sealed record AddInvoiceNoteRequest(string Note);

public static class InvoiceEndpoints
{
    public static IEndpointRouteBuilder MapInvoiceEndpoints(this IEndpointRouteBuilder app)
    {
        var invoices = app.MapGroup("/invoices");

        invoices.MapPost("/", async (CreateInvoiceRequest body, CreateInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(
                new CreateInvoiceCommand(new CustomerId(body.CustomerId), body.AmountMinor, body.Currency, body.DueDate), ct))
            .ToHttp(id => Results.Created($"/invoices/{id}", new { id = id.Value })));

        invoices.MapPost("/{id:guid}/pay", async (Guid id, PayInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new PayInvoiceCommand(new InvoiceId(id)), ct))
            .ToHttp(_ => Results.NoContent()));

        invoices.MapPost("/{id:guid}/cancel", async (Guid id, CancelInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new CancelInvoiceCommand(new InvoiceId(id)), ct))
            .ToHttp(_ => Results.NoContent()));

        invoices.MapGet("/{id:guid}/quote", async (Guid id, string currency, QuoteInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new QuoteInvoiceQuery(new InvoiceId(id), currency), ct))
            .ToHttp(money => Results.Ok(new { amountMinor = money.Minor, currency = money.Currency })));

        invoices.MapGet("/search", async (string? customer, DateOnly? from, DateOnly? to, string currency, SearchInvoicesHandler handler, CancellationToken ct) =>
            Results.Ok(await handler.HandleAsync(new SearchInvoicesQuery(customer, from, to, currency), ct)));

        invoices.MapGet("/{id:guid}/print", async (Guid id, PrintFormat format, string? title, string fileName, PrintInvoiceHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new PrintInvoiceQuery(new InvoiceId(id), format, title, fileName), ct))
            .ToHttp(doc => Results.File(doc.Content, doc.ContentType, doc.FileName)));

        // auth в бэк-офисе пока нет: оператора передаёт фронт бэк-офиса
        invoices.MapPost("/{id:guid}/note", async (Guid id, AddInvoiceNoteRequest body, HttpRequest request, AddInvoiceNoteHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(
                new AddInvoiceNoteCommand(new InvoiceId(id), body.Note, request.Headers["X-Operator-Id"].ToString()), ct))
            .ToHttp(_ => Results.NoContent()));

        return app;
    }
}
