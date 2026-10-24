namespace Billing.Api.Domain;

public enum InvoiceStatus { Draft, Issued, Paid, Cancelled }

public sealed class Invoice
{
    public required InvoiceId Id { get; init; }
    public required CustomerId CustomerId { get; init; }
    public required Money Amount { get; init; }
    public required DateOnly DueDate { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public DateTimeOffset? PaidAt { get; private set; }
    public string? PspReference { get; private set; }
    public string? PaymentEventCode { get; private set; }

    public void Issue() => Status = InvoiceStatus.Issued;

    public void MarkPaid(DateTimeOffset at)
    {
        Status = InvoiceStatus.Paid;
        PaidAt = at;
    }

    public void MarkPaidByPsp(DateTimeOffset at, string pspReference, string eventCode)
    {
        MarkPaid(at);
        PspReference = pspReference;
        PaymentEventCode = eventCode;
    }

    public void Cancel() => Status = InvoiceStatus.Cancelled;
}
