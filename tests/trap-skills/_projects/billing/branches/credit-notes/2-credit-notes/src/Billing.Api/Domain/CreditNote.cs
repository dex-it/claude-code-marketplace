using System.ComponentModel.DataAnnotations.Schema;
using Billing.Api.Application.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace Billing.Api.Domain;

public enum CreditNoteReason { Correction, Goodwill }

public enum CreditNoteStatus { Draft, PendingApproval, Issued }

[Table("credit_note_lines")]
public class CreditNoteLine
{
    public Guid Id { get; set; }
    public Guid CreditNoteId { get; set; }
    public string Description { get; set; } = "";
    public long AmountMinor { get; set; }
}

[Table("credit_notes")]
[Index(nameof(InvoiceId))]
public class CreditNote
{
    public const int MaxPerInvoice = 3;

    public Guid Id { get; private set; }
    public Guid InvoiceId { get; private set; }
    public Guid CustomerId { get; private set; }
    public string Currency { get; private set; } = "";
    public CreditNoteReason Reason { get; private set; }
    public CreditNoteStatus Status { get; set; }
    public string? Number { get; private set; }
    public long TotalMinor { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? IssuedAt { get; private set; }
    public virtual ICollection<CreditNoteLine> Lines { get; set; } = new List<CreditNoteLine>();

    public static async Task<Result<CreditNote>> CreateAsync(
        Invoice invoice, CreditNoteReason reason, DateTimeOffset now, ICreditNoteRepository notes, CancellationToken ct)
    {
        if (await notes.CountForInvoiceAsync(invoice.Id.Value, ct) >= MaxPerInvoice)
            return new CreditNoteLimitError(invoice.Id, MaxPerInvoice);

        return new CreditNote
        {
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id.Value,
            CustomerId = invoice.CustomerId.Value,
            Currency = invoice.Amount.Currency,
            Reason = reason,
            Status = CreditNoteStatus.Draft,
            CreatedAt = now,
        };
    }

    public void AddLine(string description, long amountMinor) =>
        Lines.Add(new CreditNoteLine { Id = Guid.NewGuid(), CreditNoteId = Id, Description = description, AmountMinor = amountMinor });

    public void SetTotal(long totalMinor) => TotalMinor = totalMinor;

    public void MarkIssued(DateTimeOffset at)
    {
        Status = CreditNoteStatus.Issued;
        IssuedAt = at;
    }

    public void AssignNumber(string number) => Number = number;
}

public class CreditNoteCounter
{
    public int Year { get; set; }
    public int Last { get; set; }
}

public class CreditNoteDocument
{
    public Guid Id { get; set; }
    public Guid CreditNoteId { get; set; }
    public string Template { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}
