using System.Collections.Concurrent;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryStore
{
    public ConcurrentDictionary<InvoiceId, Invoice> Invoices { get; } = new();
}
