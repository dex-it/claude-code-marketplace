namespace OrdersApi.Outbox;

public record OutboxMessage(Guid Id, string Type, string Payload, DateTime CreatedAt);

public interface IOutboxQueue
{
    /// <summary>Записывает сообщение в таблицу outbox отдельной короткой транзакцией и возвращается; доставка - OutboxDispatcher, не менее одного раза.</summary>
    Task EnqueueAsync(OutboxMessage m, CancellationToken ct);
    Task<IReadOnlyList<OutboxMessage>> TakeBatchAsync(int max, CancellationToken ct);
}
