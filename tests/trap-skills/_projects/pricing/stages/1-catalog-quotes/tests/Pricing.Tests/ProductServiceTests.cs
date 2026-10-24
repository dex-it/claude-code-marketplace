using Moq;
using Pricing.Application.Abstractions;
using Pricing.Application.Products;
using Pricing.Domain;

namespace Pricing.Tests;

public sealed class ProductServiceTests
{
    private readonly Mock<IProductRepository> _products = new();

    [Fact]
    public async Task Create_returns_product_with_requested_fields()
    {
        var service = new ProductService(_products.Object);

        var product = await service.CreateAsync(new CreateProduct("SKU-1", "Молоко", Category.Grocery, 89.9m, "sup-1"), default);

        Assert.Equal("SKU-1", product.Sku);
        Assert.Equal(89.9m, product.BasePrice);
        Assert.Equal("sup-1", product.SupplierId);
    }

    [Fact]
    public async Task Create_rejects_taken_sku()
    {
        var existing = new Product(Guid.NewGuid(), "SKU-1", "Молоко", Category.Grocery, 89.9m, "sup-1");
        _products.Setup(r => r.GetBySkuAsync("SKU-1", It.IsAny<CancellationToken>())).ReturnsAsync(existing);
        var service = new ProductService(_products.Object);

        var ex = await Assert.ThrowsAsync<DomainException>(() =>
            service.CreateAsync(new CreateProduct("SKU-1", "Кефир", Category.Grocery, 99m, "sup-1"), default));

        Assert.Equal("product.sku_taken", ex.Code);
    }
}
