using System.Collections.Concurrent;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryStore
{
    public ConcurrentDictionary<InvoiceId, Invoice> Invoices { get; } = new();
    public ConcurrentQueue<OutboxMessage> Outbox { get; } = new();
}

public sealed class OutboxMessage(object payload)
{
    public Guid Id { get; } = Guid.NewGuid();
    public object Payload { get; } = payload;
    public DateTimeOffset? SentAt { get; set; }
}
