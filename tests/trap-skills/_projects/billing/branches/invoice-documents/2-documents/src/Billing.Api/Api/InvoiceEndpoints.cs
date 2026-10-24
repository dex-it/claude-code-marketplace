using Billing.Api.Application.Documents;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record CreateInvoiceRequest(Guid CustomerId, long AmountMinor, string Currency, DateOnly DueDate);

public sealed record ExportDocumentsRequest(DateOnly Day, IReadOnlyList<ExportDocumentItem> Invoices);

public sealed record ExportDocumentItem(Guid InvoiceId, string Country);

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

        invoices.MapGet("/{id:guid}/document", async (Guid id, string country, DocumentFormat format, GetInvoiceDocumentHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new GetInvoiceDocumentQuery(new InvoiceId(id), country, format), ct))
            .ToHttp(file => Results.File(file.Content, file.ContentType, file.FileName)));

        app.MapPost("/backoffice/documents/export", async (ExportDocumentsRequest body, ExportDocumentsHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new ExportDocumentsCommand(
                body.Day, body.Invoices.Select(i => (new InvoiceId(i.InvoiceId), i.Country.ToUpperInvariant())).ToList()), ct))
            .ToHttp(count => Results.Ok(new { exported = count })));

        return app;
    }
}
