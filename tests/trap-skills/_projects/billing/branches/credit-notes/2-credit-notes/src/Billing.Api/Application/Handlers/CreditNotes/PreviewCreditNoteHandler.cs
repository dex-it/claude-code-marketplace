using Billing.Api.Application.Abstractions;
using Billing.Api.Application.CreditNotes;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed record PreviewCreditNoteQuery(Guid CreditNoteId);

public sealed record CreditNotePreview(Guid Id, long GrossMinor, long VatMinor, long TotalMinor, string Currency);

public sealed class PreviewCreditNoteHandler(ICreditNoteRepository notes)
{
    public async Task<Result<CreditNotePreview>> HandleAsync(PreviewCreditNoteQuery query, CancellationToken ct)
    {
        var note = await notes.FindAsync(query.CreditNoteId, ct);
        if (note is null)
            return new CreditNoteNotFoundError(query.CreditNoteId);

        var gross = CreditNoteMath.Gross(note.Lines);
        var vat = CreditNoteMath.Vat(gross);
        return new CreditNotePreview(note.Id, gross, (long)vat, (long)(gross + vat), note.Currency);
    }
}
