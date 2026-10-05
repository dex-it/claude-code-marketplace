namespace Billing.Api.Domain;

public enum ReceiptStatus { Pending, Sending, Sent, Failed }

public sealed class Receipt
{
    public required InvoiceId InvoiceId { get; init; }
    public required CustomerId CustomerId { get; init; }
    public required long AmountMinor { get; init; }
    public required string Currency { get; init; }
    public ReceiptStatus Status { get; set; } = ReceiptStatus.Pending;
    public int Attempts { get; private set; }

    public void StartSending()
    {
        if (Status is not (ReceiptStatus.Pending or ReceiptStatus.Failed))
            throw new InvalidOperationException($"Receipt for {InvoiceId} is {Status}, cannot start sending");
        Status = ReceiptStatus.Sending;
        Attempts++;
    }

    public void Complete() => Status = ReceiptStatus.Sent;

    public void Fail() => Status = ReceiptStatus.Failed;
}
