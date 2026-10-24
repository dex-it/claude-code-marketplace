using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryInvoiceDocumentRepository(InMemoryStore store) : IInvoiceDocumentRepository
{
    public Task AddAsync(InvoiceDocument document, CancellationToken ct)
    {
        store.Documents.Enqueue(document);
        return Task.CompletedTask;
    }

    public Task<InvoiceDocument?> FindAsync(InvoiceId invoiceId, string name, CancellationToken ct) =>
        Task.FromResult(store.Documents.FirstOrDefault(d => d.Name == name));
}
