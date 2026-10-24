namespace Billing.Api.Domain;

public enum InvoiceStatus { Draft, Issued, Paid, Cancelled }

/// <summary>
/// Счёт клиенту. Используется CreateInvoiceHandler, PayInvoiceHandler, CancelInvoiceHandler и QuoteInvoiceHandler.
/// </summary>
public sealed class Invoice
{
    public required InvoiceId Id { get; init; }
    public required CustomerId CustomerId { get; init; }
    public required Money Amount { get; init; }
    public required DateOnly DueDate { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public DateTimeOffset? PaidAt { get; private set; }

    public void Issue() => Status = InvoiceStatus.Issued;

    public void MarkPaid(DateTimeOffset at)
    {
        Status = InvoiceStatus.Paid;
        PaidAt = at;
    }

    public void Cancel() => Status = InvoiceStatus.Cancelled;
}
