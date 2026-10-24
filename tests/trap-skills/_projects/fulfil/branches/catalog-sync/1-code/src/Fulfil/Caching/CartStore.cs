using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed record Cart(IReadOnlyDictionary<string, int> Items, string? Promo);

public sealed class CartStore(IConnectionMultiplexer redis)
{
    const string ItemPrefix = "item:";
    const string PromoField = "promo";
    static readonly TimeSpan Ttl = TimeSpan.FromDays(30);

    static string Key(Guid cartId) => $"v2:cart:{cartId}";

    public async Task SetItemAsync(Guid cartId, string sku, int quantity)
    {
        var db = redis.GetDatabase();
        if (quantity <= 0)
            await db.HashDeleteAsync(Key(cartId), ItemPrefix + sku);
        else
            await db.HashSetAsync(Key(cartId), ItemPrefix + sku, quantity);
        await db.KeyExpireAsync(Key(cartId), Ttl);
    }

    public async Task SetPromoAsync(Guid cartId, string code)
    {
        var db = redis.GetDatabase();
        await db.HashSetAsync(Key(cartId), PromoField, code);
        await db.KeyExpireAsync(Key(cartId), Ttl);
    }

    public async Task<Cart> GetAsync(Guid cartId)
    {
        var entries = await redis.GetDatabase().HashGetAllAsync(Key(cartId));
        var items = new Dictionary<string, int>();
        string? promo = null;
        foreach (var e in entries)
        {
            var name = e.Name.ToString();
            if (name == PromoField) promo = e.Value.ToString();
            else if (name.StartsWith(ItemPrefix)) items[name[ItemPrefix.Length..]] = (int)e.Value;
        }
        return new Cart(items, promo);
    }
}
