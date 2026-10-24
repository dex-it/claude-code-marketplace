using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed class ApiKeyRateLimiter(RequestDelegate next, IConnectionMultiplexer redis)
{
    const int Limit = 100;
    static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    const string Script = """
        redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1] - ARGV[2])
        if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then return 0 end
        redis.call('ZADD', KEYS[1], ARGV[1], ARGV[4])
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
        return 1
        """;

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (!ctx.Request.Headers.TryGetValue("X-Api-Key", out var key) || string.IsNullOrWhiteSpace(key))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var result = await redis.GetDatabase().ScriptEvaluateAsync(
            Script,
            new RedisKey[] { $"rate:{key}" },
            new RedisValue[] { now, (long)Window.TotalMilliseconds, Limit, $"{now}:{Guid.NewGuid():N}" });

        if ((int)result == 0)
        {
            ctx.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            return;
        }
        await next(ctx);
    }
}
