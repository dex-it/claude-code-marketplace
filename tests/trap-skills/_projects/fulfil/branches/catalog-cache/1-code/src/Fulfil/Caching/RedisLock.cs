using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed record LockHandle(string Name, string Token);

public sealed class RedisLock(IConnectionMultiplexer redis)
{
    public async Task<LockHandle?> TryAcquireAsync(string name)
    {
        var token = Guid.NewGuid().ToString("N");
        var taken = await redis.GetDatabase().StringSetAsync($"lock:{name}", token, when: When.NotExists);
        return taken ? new LockHandle(name, token) : null;
    }

    public Task ReleaseAsync(LockHandle handle) =>
        redis.GetDatabase().KeyDeleteAsync($"lock:{handle.Name}");
}
