using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed record ReplaceCreditNoteLinesCommand(Guid CreditNoteId, List<CreditNoteLine> Lines);

public sealed class ReplaceCreditNoteLinesHandler(BillingDbContext db)
{
    public async Task<Result<Guid>> HandleAsync(ReplaceCreditNoteLinesCommand command, CancellationToken ct)
    {
        var note = await db.CreditNotes.Include(n => n.Lines).FirstOrDefaultAsync(n => n.Id == command.CreditNoteId, ct);
        if (note is null)
            return new CreditNoteNotFoundError(command.CreditNoteId);
        if (note.Status != CreditNoteStatus.Draft)
            return new CreditNoteInvalidStateError(note.Id, note.Status, "edit");

        note.Lines = command.Lines;
        await db.SaveChangesAsync(ct);
        return note.Id;
    }
}
