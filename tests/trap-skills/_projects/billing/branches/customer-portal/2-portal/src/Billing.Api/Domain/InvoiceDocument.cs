namespace Billing.Api.Domain;

public sealed record InvoiceDocument(InvoiceId InvoiceId, string Name, byte[] Content);
