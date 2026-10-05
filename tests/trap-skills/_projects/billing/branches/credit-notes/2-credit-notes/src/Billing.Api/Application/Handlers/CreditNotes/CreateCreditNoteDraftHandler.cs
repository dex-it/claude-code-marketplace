using Billing.Api.Application.Abstractions;
using Billing.Api.Application.CreditNotes;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed record CreditNoteLineInput(string Description, long AmountMinor);

public sealed record CreateCreditNoteDraftCommand(InvoiceId InvoiceId, CreditNoteReason Reason, IReadOnlyList<CreditNoteLineInput> Lines);

public sealed class CreateCreditNoteDraftHandler(
    ICreditNoteRepository notes,
    IInvoiceRepository invoices,
    CreateCreditNoteDraftValidator validator,
    TimeProvider clock)
{
    public async Task<Result<Guid>> HandleAsync(CreateCreditNoteDraftCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } invalid)
            return invalid;

        var invoice = await invoices.FindAsync(command.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(command.InvoiceId);

        var created = await CreditNote.CreateAsync(invoice, command.Reason, clock.GetUtcNow(), notes, ct);
        if (!created.IsSuccess)
            return created.Error!;

        var note = created.Value!;
        foreach (var line in command.Lines)
            note.AddLine(line.Description, line.AmountMinor);

        var gross = CreditNoteMath.Gross(note.Lines);
        var vat = CreditNoteMath.Vat(gross);
        note.SetTotal(CreditNoteMath.RoundToMinor(gross + vat));

        await notes.AddAsync(note, ct);
        return note.Id;
    }
}
