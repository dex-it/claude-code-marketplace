using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryInvoiceRepository(InMemoryStore store) : IInvoiceRepository
{
    public Task<Invoice?> FindAsync(InvoiceId id, CancellationToken ct) =>
        Task.FromResult(store.Invoices.GetValueOrDefault(id));

    public Task<IReadOnlyList<Invoice>> ListByStatusAsync(InvoiceStatus status, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Invoice>>(store.Invoices.Values.Where(i => i.Status == status).ToList());

    public Task AddAsync(Invoice invoice, CancellationToken ct)
    {
        store.Invoices[invoice.Id] = invoice;
        return Task.CompletedTask;
    }

    public Task SaveAsync(Invoice invoice, CancellationToken ct) => AddAsync(invoice, ct);
}
