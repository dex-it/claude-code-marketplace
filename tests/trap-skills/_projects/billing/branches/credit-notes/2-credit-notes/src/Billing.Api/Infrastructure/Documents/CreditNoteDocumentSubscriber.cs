using Billing.Api.Application.Abstractions;
using Billing.Api.Application.CreditNotes;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;

namespace Billing.Api.Infrastructure.Documents;

public sealed class CreditNoteDocumentSubscriber(
    IServiceScopeFactory scopes,
    TimeProvider clock,
    ILogger<CreditNoteDocumentSubscriber> logger) : IDomainEventHandler<CreditNoteIssued>
{
    public async Task HandleAsync(CreditNoteIssued domainEvent, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var notes = scope.ServiceProvider.GetRequiredService<ICreditNoteRepository>();
        var note = await notes.FindAsync(domainEvent.CreditNoteId, ct);
        if (note is null)
        {
            logger.LogWarning("Credit note {CreditNoteId} not found, document skipped", domainEvent.CreditNoteId);
            return;
        }

        var db = scope.ServiceProvider.GetRequiredService<BillingDbContext>();
        db.CreditNoteDocuments.Add(new CreditNoteDocument
        {
            Id = Guid.NewGuid(),
            CreditNoteId = note.Id,
            Template = note.Reason == CreditNoteReason.Goodwill ? "credit-goodwill" : "credit-correction",
            CreatedAt = clock.GetUtcNow(),
        });
        await db.SaveChangesAsync(ct);
    }
}
