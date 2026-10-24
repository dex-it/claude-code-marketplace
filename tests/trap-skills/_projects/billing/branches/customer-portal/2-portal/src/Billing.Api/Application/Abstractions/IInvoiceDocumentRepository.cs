using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface IInvoiceDocumentRepository
{
    Task AddAsync(InvoiceDocument document, CancellationToken ct);
    Task<InvoiceDocument?> FindAsync(InvoiceId invoiceId, string name, CancellationToken ct);
}
