using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed record LockHandle(string Name, string Token, long Fence);

public sealed class RedisLock(IConnectionMultiplexer redis)
{
    const string ReleaseScript =
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

    public async Task<LockHandle?> TryAcquireAsync(string name, TimeSpan ttl)
    {
        var db = redis.GetDatabase();
        var token = Guid.NewGuid().ToString("N");
        if (!await db.StringSetAsync($"lock:{name}", token, ttl, When.NotExists)) return null;

        var fence = await db.StringIncrementAsync($"fence:{name}");
        return new LockHandle(name, token, fence);
    }

    public async Task ReleaseAsync(LockHandle handle) =>
        await redis.GetDatabase().ScriptEvaluateAsync(
            ReleaseScript,
            new RedisKey[] { $"lock:{handle.Name}" },
            new RedisValue[] { handle.Token });
}
