using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using Moq;
using Pricing.Application.Abstractions;
using Pricing.Application.Promotions;
using Pricing.Application.Quotes;
using Pricing.Domain;

namespace Pricing.Tests;

public sealed class QuoteServiceTests
{
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 9, 28, 9, 30, 0, TimeSpan.Zero));
    private readonly Mock<IProductRepository> _products = new();
    private readonly Mock<ISupplierCatalog> _suppliers = new();

    private QuoteService CreateService()
    {
        var promotions = new Mock<IPromotionRepository>();
        promotions.Setup(r => r.ListAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        return new QuoteService(_products.Object, _suppliers.Object, new PromotionService(promotions.Object, _time),
            _time, NullLogger<QuoteService>.Instance);
    }

    private void GivenProduct(string sku, decimal basePrice) =>
        _products.Setup(r => r.GetBySkuAsync(sku, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Product(Guid.NewGuid(), sku, "Товар", Category.Grocery, basePrice, "sup-1"));

    [Fact]
    public async Task Supplier_that_does_not_answer_in_time_gives_base_price()
    {
        GivenProduct("SKU-1", 100m);
        GivenProduct("SKU-2", 50m);
        _suppliers.Setup(s => s.GetPriceAsync("sup-1", It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(async (string _, string _, CancellationToken token) =>
            {
                await Task.Delay(Timeout.InfiniteTimeSpan, token);
                return null;
            });

        var quoting = CreateService().QuoteAsync([new QuoteLine("SKU-1", 1), new QuoteLine("SKU-2", 2)], default);
        _time.Advance(TimeSpan.FromSeconds(2.5));
        var quote = await quoting;

        Assert.Equal(200m, quote.Total);
    }

    [Fact]
    public async Task Higher_supplier_price_wins()
    {
        GivenProduct("SKU-1", 100m);
        _suppliers.Setup(s => s.GetPriceAsync("sup-1", "SKU-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SupplierPrice("SKU-1", 120m, "RUB"));

        var quote = await CreateService().QuoteAsync([new QuoteLine("SKU-1", 1)], default);

        Assert.Equal(120m, quote.Lines[0].UnitPrice);
    }

    [Fact]
    public async Task Caller_cancellation_is_not_swallowed()
    {
        GivenProduct("SKU-1", 100m);
        _suppliers.Setup(s => s.GetPriceAsync("sup-1", "SKU-1", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            CreateService().QuoteAsync([new QuoteLine("SKU-1", 1)], cts.Token));
    }
}
