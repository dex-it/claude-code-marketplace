using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed class OrderStatusCache(IConnectionMultiplexer redis)
{
    static readonly TimeSpan ProcessingTtl = TimeSpan.FromSeconds(5);

    static string Key(Guid orderId) => $"order:processing:{orderId}";

    public Task MarkProcessingAsync(Guid orderId) =>
        redis.GetDatabase().StringSetAsync(Key(orderId), "1", ProcessingTtl);

    public Task<bool> IsProcessingAsync(Guid orderId) =>
        redis.GetDatabase().KeyExistsAsync(Key(orderId));
}
