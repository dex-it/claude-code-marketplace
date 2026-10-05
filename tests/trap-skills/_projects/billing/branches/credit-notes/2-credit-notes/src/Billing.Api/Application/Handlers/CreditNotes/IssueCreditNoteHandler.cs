using Billing.Api.Application.Abstractions;
using Billing.Api.Application.CreditNotes;
using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Application.Messages;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed record IssueCreditNoteCommand(Guid CreditNoteId, Invoice Invoice);

public sealed class IssueCreditNoteHandler(
    BillingDbContext db,
    IOutbox outbox,
    IDomainEventPublisher events,
    CancelInvoiceHandler cancelInvoice,
    TimeProvider clock)
{
    public async Task<Result<string>> HandleAsync(IssueCreditNoteCommand command, CancellationToken ct)
    {
        var note = await db.CreditNotes.Include(n => n.Lines).FirstOrDefaultAsync(n => n.Id == command.CreditNoteId, ct);
        if (note is null)
            return new CreditNoteNotFoundError(command.CreditNoteId);
        if (note.Status != CreditNoteStatus.Draft)
            return new CreditNoteInvalidStateError(note.Id, note.Status, "issue");

        var invoice = command.Invoice;
        if (invoice.Status == InvoiceStatus.Draft)
            return new InvoiceInvalidStateError(invoice.Id, invoice.Status, "credit");

        var alreadyIssued = await db.CreditNotes
            .Where(n => n.InvoiceId == note.InvoiceId && n.Status == CreditNoteStatus.Issued)
            .SumAsync(n => n.TotalMinor, ct);

        var now = clock.GetUtcNow();
        note.MarkIssued(now);
        await events.PublishAsync(new CreditNoteIssued(note.Id), ct);
        await db.SaveChangesAsync(ct);

        var counter = await db.CreditNoteCounters.FindAsync([now.Year], ct);
        if (counter is null)
        {
            counter = new CreditNoteCounter { Year = now.Year };
            db.CreditNoteCounters.Add(counter);
        }
        counter.Last++;
        note.AssignNumber($"CN-{now.Year}-{counter.Last:D5}");
        await db.SaveChangesAsync(ct);

        if (invoice.Status == InvoiceStatus.Paid)
        {
            var reversal = new Money(-note.TotalMinor, note.Currency);
            await outbox.EnqueueAsync(new LedgerPostingRequested($"credit-{note.Id}", reversal, $"Credit note {note.Number}"), ct);
        }

        if (alreadyIssued + note.TotalMinor == invoice.Amount.Minor)
            await cancelInvoice.HandleAsync(new CancelInvoiceCommand(invoice.Id), ct);

        return note.Number!;
    }
}
