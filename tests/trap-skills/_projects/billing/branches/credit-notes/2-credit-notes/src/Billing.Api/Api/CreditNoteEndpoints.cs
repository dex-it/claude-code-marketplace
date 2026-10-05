using Billing.Api.Application.Abstractions;
using Billing.Api.Application.Handlers.CreditNotes;
using Billing.Api.Domain;

namespace Billing.Api.Api;

public sealed record CreditNoteLineRequest(string Description, long AmountMinor);

public sealed record CreateCreditNoteRequest(CreditNoteReason Reason, IReadOnlyList<CreditNoteLineRequest> Lines);

public sealed record ReplaceCreditNoteLinesRequest(List<CreditNoteLine> Lines);

public static class CreditNoteEndpoints
{
    public static IEndpointRouteBuilder MapCreditNoteEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/invoices/{id:guid}/credit-notes", async (Guid id, CreateCreditNoteRequest body, CreateCreditNoteDraftHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new CreateCreditNoteDraftCommand(
                new InvoiceId(id), body.Reason, body.Lines.Select(l => new CreditNoteLineInput(l.Description, l.AmountMinor)).ToList()), ct))
            .ToHttp(noteId => Results.Created($"/credit-notes/{noteId}", new { id = noteId })));

        app.MapGet("/credit-notes/{id:guid}/preview", async (Guid id, PreviewCreditNoteHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new PreviewCreditNoteQuery(id), ct))
            .ToHttp(preview => Results.Ok(preview)));

        app.MapPut("/credit-notes/{id:guid}/lines", async (Guid id, ReplaceCreditNoteLinesRequest body, ReplaceCreditNoteLinesHandler handler, CancellationToken ct) =>
            (await handler.HandleAsync(new ReplaceCreditNoteLinesCommand(id, body.Lines), ct))
            .ToHttp(_ => Results.NoContent()));

        app.MapPost("/invoices/{invoiceId:guid}/credit-notes/{noteId:guid}/issue", async (
            Guid invoiceId,
            Guid noteId,
            IInvoiceRepository invoices,
            ICreditNoteRepository notes,
            IssueCreditNoteHandler handler,
            CancellationToken ct) =>
        {
            var invoice = await invoices.FindAsync(new InvoiceId(invoiceId), ct);
            var note = await notes.FindAsync(noteId, ct);
            var issued = await notes.IssuedTotalForInvoiceAsync(invoiceId, ct);
            if (note is not null && issued + note.TotalMinor > invoice!.Amount.Minor)
                return Results.Problem(
                    "Credit notes exceed invoice amount",
                    statusCode: StatusCodes.Status409Conflict,
                    extensions: new Dictionary<string, object?> { ["code"] = "credit_note.exceeds_invoice" });

            return (await handler.HandleAsync(new IssueCreditNoteCommand(noteId, invoice!), ct))
                .ToHttp(number => Results.Ok(new { number }));
        });

        app.MapGet("/customers/{id:guid}/credit-notes", (Guid id, CustomerCreditNotesHandler handler) =>
            Results.Ok(handler.Handle(new CustomerCreditNotesQuery(new CustomerId(id)))));

        app.MapGet("/backoffice/credit-notes/dashboard", async (int year, int month, CreditNotesDashboardHandler handler, CancellationToken ct) =>
            Results.Ok(await handler.HandleAsync(new CreditNotesDashboardQuery(year, month), ct)));

        return app;
    }
}
