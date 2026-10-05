namespace Billing.Contracts;

public sealed record InvoicePaidV1(Guid InvoiceId, Guid CustomerId, long AmountMinor, string Currency, DateTimeOffset PaidAt);
