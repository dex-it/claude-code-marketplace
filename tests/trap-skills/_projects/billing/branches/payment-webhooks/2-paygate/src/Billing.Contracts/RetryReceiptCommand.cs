namespace Billing.Contracts;

public sealed record RetryReceiptCommand(Guid InvoiceId, int Attempt);
