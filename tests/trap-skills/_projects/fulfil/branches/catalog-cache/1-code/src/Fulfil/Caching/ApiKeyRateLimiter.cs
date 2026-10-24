using Fulfil.Options;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed class ApiKeyRateLimiter(RequestDelegate next, IOptions<FulfilOptions> options, ILogger<ApiKeyRateLimiter> log)
{
    const int Limit = 100;
    static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (!ctx.Request.Headers.TryGetValue("X-Api-Key", out var key) || string.IsNullOrWhiteSpace(key))
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        await using var redis = await ConnectionMultiplexer.ConnectAsync(RedisConnection.Build(options.Value));
        var db = redis.GetDatabase();
        var counter = $"rate:{key}";
        var count = await db.StringIncrementAsync(counter);
        if (count == 1) await db.KeyExpireAsync(counter, Window);

        if (count > Limit)
        {
            log.LogWarning("Rate limit exceeded for key {ApiKey}", key.ToString());
            ctx.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            return;
        }
        await next(ctx);
    }
}
