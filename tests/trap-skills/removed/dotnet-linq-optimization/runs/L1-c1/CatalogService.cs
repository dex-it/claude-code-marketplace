using Microsoft.EntityFrameworkCore;

namespace Shop;

public sealed record ProductCardDto(Guid Id, string Name, decimal Price);

public sealed record CartItemDto(Guid Id, string Name, decimal Price, int Stock);

public class CatalogService
{
    private const int MaxPageSize = 200;

    private readonly ShopDbContext _db;

    public CatalogService(ShopDbContext db) => _db = db;

    // Проекция сразу в DTO - Image и Reviews карточкам не нужны и в SELECT не попадают.
    public async Task<List<ProductCardDto>> SearchAsync(
        string? category,
        decimal? minPrice,
        bool onlyActive,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        IQueryable<Product> query = _db.Products.AsNoTracking();

        if (onlyActive)
            query = query.Where(p => p.IsActive);

        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(p => p.Category == category);

        if (minPrice is not null)
            query = query.Where(p => p.Price >= minPrice.Value);

        return await query
            .OrderBy(p => p.Name)
            .ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new ProductCardDto(p.Id, p.Name, p.Price))
            .ToListAsync(ct);
    }

    public Task<bool> HasOrdersAsync(Guid customerId, CancellationToken ct = default) =>
        _db.Orders.AsNoTracking().AnyAsync(o => o.CustomerId == customerId, ct);

    // Npgsql транслирует Contains по массиву в "= ANY(@p)", поэтому тысячи id безопасны без чанкинга.
    public async Task<List<CartItemDto>> GetByIdsAsync(IReadOnlyList<Guid> ids, CancellationToken ct = default)
    {
        if (ids.Count == 0)
            return new List<CartItemDto>();

        var idArray = ids as Guid[] ?? ids.ToArray();

        return await _db.Products
            .AsNoTracking()
            .Where(p => idArray.Contains(p.Id))
            .Select(p => new CartItemDto(p.Id, p.Name, p.Price, p.Stock))
            .ToListAsync(ct);
    }
}
