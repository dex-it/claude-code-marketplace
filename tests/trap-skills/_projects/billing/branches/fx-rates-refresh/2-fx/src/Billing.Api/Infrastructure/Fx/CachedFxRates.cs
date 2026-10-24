using System.Collections.Concurrent;

namespace Billing.Api.Infrastructure.Fx;

public sealed class CachedFxRates(FxRatesClient fx, TimeProvider clock)
{
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(10);
    private static readonly ConcurrentDictionary<(string From, string To), (decimal Rate, DateTimeOffset At)> Rates = new();

    public async Task<decimal> GetAsync(string from, string to, CancellationToken ct)
    {
        if (from == to)
            return 1m;
        if (Rates.TryGetValue((from, to), out var cached) && clock.GetUtcNow() - cached.At < Ttl)
            return cached.Rate;

        var rate = await fx.GetRateAsync(from, to, ct);
        Rates[(from, to)] = (rate, clock.GetUtcNow());
        return rate;
    }
}
