using Moq;
using Pricing.Application.Abstractions;
using Pricing.Application.Promotions;
using Pricing.Application.Quotes;
using Pricing.Domain;

namespace Pricing.Tests;

public sealed class QuoteServiceTests
{
    private readonly Mock<ISupplierCatalog> _suppliers = new();
    private readonly Mock<IPromotionRepository> _promotions = new();

    public QuoteServiceTests() =>
        _promotions.Setup(r => r.ListAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);

    private QuoteService Service() =>
        new(new TestCatalog(), _suppliers.Object, new PromotionService(_promotions.Object));

    [Fact]
    public async Task Quote_asks_supplier_for_each_line()
    {
        await Service().QuoteAsync([new QuoteLine("SKU-42", 2), new QuoteLine("SKU-43", 1)], default);

        _suppliers.Verify(s => s.GetPriceAsync("sup-1", "SKU-42", It.IsAny<CancellationToken>()), Times.Once);
        _suppliers.Verify(s => s.GetPriceAsync("sup-2", "SKU-43", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Quote_uses_base_price_when_supplier_is_cheaper()
    {
        _suppliers.Setup(s => s.GetPriceAsync("sup-1", "SKU-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SupplierPrice("SKU-42", 80m, "RUB"));

        var quote = await Service().QuoteAsync([new QuoteLine("SKU-42", 3)], default);

        Assert.True(quote.Total == 300m);
    }

    [Fact]
    public async Task Quote_uses_supplier_price_when_it_is_higher()
    {
        var milk = TestCatalog.Products.Single(p => p.Sku == "SKU-42");
        milk.ChangePrice(90m);
        _suppliers.Setup(s => s.GetPriceAsync("sup-1", "SKU-42", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SupplierPrice("SKU-42", 95m, "RUB"));

        var quote = await Service().QuoteAsync([new QuoteLine("SKU-42", 1)], default);

        Assert.Equal(95m, quote.Lines[0].UnitPrice);
        milk.ChangePrice(100m);
    }

    [Fact]
    public async Task Quote_of_unknown_sku_is_not_found()
    {
        var ex = await Assert.ThrowsAsync<NotFoundException>(() =>
            Service().QuoteAsync([new QuoteLine("SKU-404", 1)], default));

        Assert.Equal("product.not_found", ex.Code);
    }
}
