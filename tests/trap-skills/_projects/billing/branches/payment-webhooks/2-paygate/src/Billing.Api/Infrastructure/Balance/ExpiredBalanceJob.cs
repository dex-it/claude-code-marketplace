using StackExchange.Redis;

namespace Billing.Api.Infrastructure.Balance;

public sealed class ExpiredBalanceJob(IConnectionMultiplexer redis, TimeProvider clock, ILogger<ExpiredBalanceJob> logger) : BackgroundService
{
    private static readonly TimeSpan Expiry = TimeSpan.FromDays(365);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24), clock);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            var db = redis.GetDatabase();
            var server = redis.GetServers()[0];
            var threshold = clock.GetUtcNow().Subtract(Expiry).ToUnixTimeSeconds();

            await foreach (var topUpKey in server.KeysAsync(pattern: "balance-topup:*"))
            {
                var lastTopUp = (long?)await db.StringGetAsync(topUpKey);
                if (lastTopUp is null || lastTopUp > threshold)
                    continue;

                var customer = topUpKey.ToString()["balance-topup:".Length..];
                await foreach (var balanceKey in server.KeysAsync(pattern: $"balance:{customer}:*"))
                {
                    await db.StringSetAsync(balanceKey, 0);
                    logger.LogInformation("Balance {Key} expired", balanceKey.ToString());
                }
            }
        }
    }
}
