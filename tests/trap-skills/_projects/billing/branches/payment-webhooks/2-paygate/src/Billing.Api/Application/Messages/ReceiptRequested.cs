namespace Billing.Api.Application.Messages;

public sealed record ReceiptRequested(Guid InvoiceId);
