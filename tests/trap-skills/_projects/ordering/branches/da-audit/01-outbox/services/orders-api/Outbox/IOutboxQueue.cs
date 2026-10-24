namespace OrdersApi.Outbox;

public record OutboxMessage(Guid Id, string Type, string Payload, DateTime CreatedAt);

public interface IOutboxQueue
{
    /// <summary>Сохраняет сообщение: после возврата оно будет доставлено потребителю.</summary>
    Task EnqueueAsync(OutboxMessage m, CancellationToken ct);
    Task<IReadOnlyList<OutboxMessage>> TakeBatchAsync(int max, CancellationToken ct);
}
