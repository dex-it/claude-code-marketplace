using Pricing.Application.Abstractions;
using Pricing.Domain;

namespace Pricing.Application.Products;

public sealed record CreateProduct(string Sku, string Name, Category Category, decimal BasePrice, string SupplierId);

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

public sealed class ProductService(IProductRepository products)
{
    public async Task<Product> GetAsync(Guid id, CancellationToken ct) =>
        await products.GetAsync(id, ct) ?? throw new NotFoundException("product.not_found", $"Товар {id} не найден");

    public async Task<PagedResult<Product>> ListAsync(int page, int pageSize, CancellationToken ct)
    {
        var items = await products.ListAsync((page - 1) * pageSize, pageSize, ct);
        return new PagedResult<Product>(items, page, pageSize, await products.CountAsync(ct));
    }

    public async Task<IReadOnlyList<Product>> ListByCategoryAsync(Category category, CancellationToken ct)
    {
        var all = await products.ListAsync(0, int.MaxValue, ct);
        return all.Where(p => p.Category == category && !p.IsArchived).ToList();
    }

    public async Task<Product> ChangePriceAsync(Guid id, decimal price, CancellationToken ct)
    {
        var product = await GetAsync(id, ct);
        product.ChangePrice(price);
        return product;
    }

    public async Task<Product> CreateAsync(CreateProduct cmd, CancellationToken ct)
    {
        if (await products.GetBySkuAsync(cmd.Sku, ct) is not null)
            throw new DomainException("product.sku_taken", $"SKU {cmd.Sku} уже есть");
        var product = new Product(Guid.NewGuid(), cmd.Sku, cmd.Name, cmd.Category, cmd.BasePrice, cmd.SupplierId);
        await products.AddAsync(product, ct);
        return product;
    }
}
