using System.Collections.Concurrent;
using System.Globalization;
using Fulfil.Ports;
using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed class PriceCache(IConnectionMultiplexer redis, IPriceSource source)
{
    static readonly TimeSpan BaseTtl = TimeSpan.FromMinutes(10);
    readonly ConcurrentDictionary<string, Lazy<Task<decimal>>> _loading = new();

    IDatabase Db => redis.GetDatabase();

    static string Key(string sku) => $"price:{sku}";

    static TimeSpan Ttl() => BaseTtl + TimeSpan.FromSeconds(Random.Shared.Next(0, 90));

    static string Encode(decimal price) => price.ToString(CultureInfo.InvariantCulture);

    static decimal Decode(RedisValue value) => decimal.Parse(value.ToString(), CultureInfo.InvariantCulture);

    public async Task<decimal> GetAsync(string sku, CancellationToken ct)
    {
        var key = Key(sku);
        var cached = await Db.StringGetAsync(key);
        if (cached.HasValue) return Decode(cached);

        var load = _loading.GetOrAdd(key, _ => new Lazy<Task<decimal>>(() => LoadAsync(sku, key)));
        try
        {
            return await load.Value.WaitAsync(ct);
        }
        finally
        {
            _loading.TryRemove(new KeyValuePair<string, Lazy<Task<decimal>>>(key, load));
        }
    }

    async Task<decimal> LoadAsync(string sku, string key)
    {
        var cached = await Db.StringGetAsync(key);
        if (cached.HasValue) return Decode(cached);

        var price = await source.GetPriceAsync(sku, CancellationToken.None);
        await Db.StringSetAsync(key, Encode(price), Ttl());
        return price;
    }

    public Task InvalidateAsync(string sku) => Db.KeyDeleteAsync(Key(sku));
}
