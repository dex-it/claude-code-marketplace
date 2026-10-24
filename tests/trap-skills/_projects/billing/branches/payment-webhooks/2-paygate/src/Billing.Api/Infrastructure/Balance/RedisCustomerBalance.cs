using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using StackExchange.Redis;

namespace Billing.Api.Infrastructure.Balance;

public sealed class RedisCustomerBalance(IConnectionMultiplexer redis, TimeProvider clock) : ICustomerBalance
{
    private static readonly TimeSpan DebitLockLease = TimeSpan.FromSeconds(5);

    public async Task<long> GetAsync(CustomerId customerId, string currency, CancellationToken ct) =>
        (long?)await redis.GetDatabase().StringGetAsync(BalanceKey(customerId, currency)) ?? 0;

    public async Task CreditAsync(CustomerId customerId, Money amount, CancellationToken ct)
    {
        var db = redis.GetDatabase();
        var current = (long?)await db.StringGetAsync(BalanceKey(customerId, amount.Currency)) ?? 0;
        await db.StringSetAsync(BalanceKey(customerId, amount.Currency), current + amount.Minor);
        await db.StringSetAsync(LastTopUpKey(customerId), clock.GetUtcNow().ToUnixTimeSeconds());
    }

    public async Task<bool> TryDebitAsync(CustomerId customerId, Money amount, CancellationToken ct)
    {
        var db = redis.GetDatabase();
        var lockKey = $"balance-lock:{customerId}";
        var token = Guid.NewGuid().ToString();
        if (!await db.LockTakeAsync(lockKey, token, DebitLockLease))
            return false;

        try
        {
            var key = BalanceKey(customerId, amount.Currency);
            var current = (long?)await db.StringGetAsync(key) ?? 0;
            if (current < amount.Minor)
                return false;
            await db.StringSetAsync(key, current - amount.Minor);
            return true;
        }
        finally
        {
            await db.LockReleaseAsync(lockKey, token);
        }
    }

    internal static string BalanceKey(CustomerId customerId, string currency) => $"balance:{customerId}:{currency}";

    internal static string LastTopUpKey(CustomerId customerId) => $"balance-topup:{customerId}";
}
