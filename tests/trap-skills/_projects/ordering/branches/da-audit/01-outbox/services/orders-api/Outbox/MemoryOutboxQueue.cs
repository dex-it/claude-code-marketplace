using System.Collections.Concurrent;

namespace OrdersApi.Outbox;

public class MemoryOutboxQueue : IOutboxQueue
{
    private readonly ConcurrentQueue<OutboxMessage> _q = new();

    public Task EnqueueAsync(OutboxMessage m, CancellationToken ct)
    {
        _q.Enqueue(m);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<OutboxMessage>> TakeBatchAsync(int max, CancellationToken ct)
    {
        var list = new List<OutboxMessage>();
        while (list.Count < max && _q.TryDequeue(out var m)) list.Add(m);
        return Task.FromResult<IReadOnlyList<OutboxMessage>>(list);
    }
}
