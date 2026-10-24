using System.Globalization;
using Fulfil.Ports;
using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed class PriceCache(IConnectionMultiplexer redis, IPriceSource source)
{
    IDatabase Db => redis.GetDatabase();

    static string Key(string sku) => sku;

    static string Encode(decimal price) => Math.Round(price).ToString(CultureInfo.InvariantCulture);

    static decimal Decode(RedisValue value) => decimal.Parse(value.ToString(), CultureInfo.InvariantCulture);

    public async Task<decimal> GetAsync(string sku, CancellationToken ct)
    {
        var cached = await Db.StringGetAsync(Key(sku));
        if (cached.HasValue) return Decode(cached);

        var price = await source.GetPriceAsync(sku, ct);
        await Db.StringSetAsync(Key(sku), Encode(price));
        return price;
    }
}
