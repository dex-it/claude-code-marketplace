using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed record CustomerCreditNotesQuery(CustomerId CustomerId);

public sealed record CreditNoteListItem(Guid Id, Guid InvoiceId, string? Number, CreditNoteStatus Status, long TotalMinor, string Currency);

public sealed class CustomerCreditNotesHandler(ICreditNoteRepository notes)
{
    public IReadOnlyList<CreditNoteListItem> Handle(CustomerCreditNotesQuery query) =>
        notes.Query()
            .Where(n => n.CustomerId == query.CustomerId.Value)
            .OrderBy(n => n.Number)
            .Select(n => new CreditNoteListItem(n.Id, n.InvoiceId, n.Number, n.Status, n.TotalMinor, n.Currency))
            .ToList();
}
