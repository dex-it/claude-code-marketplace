using Microsoft.EntityFrameworkCore;

namespace Shop;

public record CatalogItemDto(Guid Id, string Name, decimal Price);

public record CartItemDto(Guid Id, string Name, decimal Price, int Stock);

public class CatalogService
{
    private readonly ShopDbContext _db;
    public CatalogService(ShopDbContext db) => _db = db;

    // Только 3 узких поля, без Description/Image - список карточек не должен тащить BLOB.
    public async Task<List<CatalogItemDto>> Search(
        string? category,
        decimal? minPrice,
        bool onlyActive,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        if (page < 1) throw new ArgumentOutOfRangeException(nameof(page), page, "page must be >= 1");
        if (pageSize < 1) throw new ArgumentOutOfRangeException(nameof(pageSize), pageSize, "pageSize must be >= 1");

        var query = _db.Products.AsNoTracking();

        if (onlyActive)
            query = query.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(p => p.Category == category);

        if (minPrice is not null)
            query = query.Where(p => p.Price >= minPrice.Value);

        // ThenBy(Id): Name не уникален, без тай-брейкера Skip/Take даёт нестабильную страницу.
        return await query
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new CatalogItemDto(p.Id, p.Name, p.Price))
            .ToListAsync(ct);
    }

    public Task<bool> HasOrders(Guid customerId, CancellationToken ct = default) =>
        _db.Orders.AsNoTracking().AnyAsync(o => o.CustomerId == customerId, ct);

    public async Task<List<CartItemDto>> GetByIds(IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        if (ids.Count == 0)
            return new List<CartItemDto>();

        // Npgsql шлёт Contains по Guid-коллекции как один array-параметр ANY($1), не IN(@p1..@pN).
        return await _db.Products
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new CartItemDto(p.Id, p.Name, p.Price, p.Stock))
            .ToListAsync(ct);
    }
}
