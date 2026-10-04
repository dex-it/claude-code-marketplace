using Billing.Api.Application.Abstractions;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryOutbox(InMemoryStore store) : IOutbox
{
    public Task EnqueueAsync<T>(T message, CancellationToken ct) where T : notnull
    {
        store.Outbox.Enqueue(new OutboxMessage(message));
        return Task.CompletedTask;
    }
}
