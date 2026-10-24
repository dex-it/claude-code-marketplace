using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryReceiptRepository(InMemoryStore store) : IReceiptRepository
{
    public Task<Receipt?> FindAsync(InvoiceId invoiceId, CancellationToken ct) =>
        Task.FromResult(store.Receipts.GetValueOrDefault(invoiceId));

    public Task SaveAsync(Receipt receipt, CancellationToken ct)
    {
        store.Receipts[receipt.InvoiceId] = receipt;
        return Task.CompletedTask;
    }
}
