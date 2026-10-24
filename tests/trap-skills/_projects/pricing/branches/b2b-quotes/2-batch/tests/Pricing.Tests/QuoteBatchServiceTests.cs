using Moq;
using Pricing.Application.Abstractions;
using Pricing.Application.Quotes;

namespace Pricing.Tests;

public sealed class QuoteBatchServiceTests
{
    private readonly Mock<IPricingSources> _sources = new();
    private readonly Mock<ISupplierCatalog> _suppliers = new();
    private readonly Mock<IPromotionRepository> _promotions = new();
    private readonly Mock<IB2BNotifier> _notifier = new();

    public QuoteBatchServiceTests()
    {
        _promotions.Setup(r => r.ListAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        _sources.Setup(s => s.Products).Returns(new TestCatalog());
        _sources.Setup(s => s.Suppliers).Returns(_suppliers.Object);
        _sources.Setup(s => s.Promotions).Returns(_promotions.Object);
    }

    [Fact]
    public async Task Batch_quote_is_available_after_completion()
    {
        var service = new QuoteBatchService(_sources.Object, _notifier.Object);

        var id = service.Start("b2b-7", [new QuoteLine("SKU-42", 10), new QuoteLine("SKU-43", 2)]);
        await Task.Delay(500);

        var quote = service.TryGet(id);
        Assert.NotNull(quote);
        Assert.Equal(1900m, quote.Total);
    }

    [Fact]
    public async Task Customer_is_notified_when_quote_is_ready()
    {
        var service = new QuoteBatchService(_sources.Object, _notifier.Object);

        var id = service.Start("b2b-7", [new QuoteLine("SKU-43", 1)]);
        await Task.Delay(500);

        _notifier.Verify(n => n.QuoteReadyAsync("b2b-7", id, It.IsAny<CancellationToken>()), Times.Once);
    }
}
