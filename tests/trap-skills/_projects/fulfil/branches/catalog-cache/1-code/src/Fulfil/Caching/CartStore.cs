using System.Text.Json;
using StackExchange.Redis;

namespace Fulfil.Caching;

public sealed record Cart(Dictionary<string, int> Items, string? Promo);

public sealed class CartStore(IConnectionMultiplexer redis)
{
    static readonly TimeSpan Ttl = TimeSpan.FromDays(30);

    static string Key(Guid cartId) => $"v2:cart:{cartId}";

    public async Task SetItemAsync(Guid cartId, string sku, int quantity)
    {
        var cart = await GetAsync(cartId);
        if (quantity <= 0) cart.Items.Remove(sku);
        else cart.Items[sku] = quantity;
        await SaveAsync(cartId, cart);
    }

    public async Task SetPromoAsync(Guid cartId, string code)
    {
        var cart = await GetAsync(cartId);
        await SaveAsync(cartId, cart with { Promo = code });
    }

    public async Task<Cart> GetAsync(Guid cartId)
    {
        var json = await redis.GetDatabase().StringGetAsync(Key(cartId));
        return json.HasValue ? JsonSerializer.Deserialize<Cart>(json.ToString())! : new Cart([], null);
    }

    Task SaveAsync(Guid cartId, Cart cart) =>
        redis.GetDatabase().StringSetAsync(Key(cartId), JsonSerializer.Serialize(cart), Ttl);
}
