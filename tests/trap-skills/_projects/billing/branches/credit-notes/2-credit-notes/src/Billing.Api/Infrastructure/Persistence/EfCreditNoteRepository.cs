using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class EfCreditNoteRepository(BillingDbContext db) : ICreditNoteRepository
{
    private const long GoodwillApprovalThresholdMinor = 500_000;

    public IQueryable<CreditNote> Query() => db.CreditNotes;

    public Task<CreditNote?> FindAsync(Guid id, CancellationToken ct) =>
        db.CreditNotes.Include(n => n.Lines).FirstOrDefaultAsync(n => n.Id == id, ct);

    public Task<int> CountForInvoiceAsync(Guid invoiceId, CancellationToken ct) =>
        db.CreditNotes.CountAsync(n => n.InvoiceId == invoiceId, ct);

    public Task<long> IssuedTotalForInvoiceAsync(Guid invoiceId, CancellationToken ct) =>
        db.CreditNotes.Where(n => n.InvoiceId == invoiceId && n.Status == CreditNoteStatus.Issued).SumAsync(n => n.TotalMinor, ct);

    public async Task<IReadOnlyList<CreditNote>> ListIssuedAsync(CancellationToken ct) =>
        await db.CreditNotes.Include(n => n.Lines).Where(n => n.Status == CreditNoteStatus.Issued).ToListAsync(ct);

    public async Task AddAsync(CreditNote note, CancellationToken ct)
    {
        if (note.Reason == CreditNoteReason.Goodwill && note.TotalMinor > GoodwillApprovalThresholdMinor)
            note.Status = CreditNoteStatus.PendingApproval;

        db.CreditNotes.Add(note);
        await db.SaveChangesAsync(ct);
    }
}
