using Moq;
using Pricing.Application.Abstractions;
using Pricing.Application.Promotions;
using Pricing.Domain;

namespace Pricing.Tests;

public sealed class PromotionServiceTests
{
    private readonly Mock<IPromotionRepository> _promotions = new();

    private Task<decimal> DiscountAsync(Category category, params Promotion[] promotions)
    {
        _promotions.Setup(r => r.ListAsync(It.IsAny<CancellationToken>())).ReturnsAsync(promotions);
        return new PromotionService(_promotions.Object).CurrentDiscountAsync(category, default);
    }

    private static Promotion Around(TimeOnly now, Category category, decimal percent) =>
        new(Guid.NewGuid(), category, percent, now.AddMinutes(-30), now.AddMinutes(30));

    [Theory]
    [InlineData(Category.Grocery, true, false, 10)]
    [InlineData(Category.Grocery, false, false, 0)]
    [InlineData(Category.Household, true, true, 15)]
    [InlineData(Category.Household, true, false, 0)]
    public async Task Discount_by_category(Category category, bool active, bool sameCategory, int expected)
    {
        var now = TimeOnly.FromDateTime(DateTime.Now);
        var promoCategory = sameCategory ? category : Category.Electronics;
        var promo = active
            ? Around(now, category == Category.Grocery ? category : promoCategory, expected == 0 ? 15 : expected)
            : new Promotion(Guid.NewGuid(), category, 10, now.AddHours(2), now.AddHours(3));

        Assert.Equal(expected, await DiscountAsync(category, promo));
    }

    [Theory]
    [InlineData(5, 10, 10)]
    [InlineData(20, 7, 20)]
    [InlineData(3, 3, 3)]
    public async Task Discount_is_the_largest_active(int first, int second, int expected)
    {
        var now = TimeOnly.FromDateTime(DateTime.Now);

        var discount = await DiscountAsync(Category.Grocery,
            Around(now, Category.Grocery, first), Around(now, Category.Grocery, second));

        Assert.Equal(expected, discount);
    }

    [Fact]
    public async Task Night_promotion_works_after_midnight()
    {
        var now = TimeOnly.FromDateTime(DateTime.Now);
        var promo = new Promotion(Guid.NewGuid(), Category.Grocery, 12, new TimeOnly(22, 0), new TimeOnly(2, 0));

        var discount = await DiscountAsync(Category.Grocery, promo);

        Assert.Equal(now.Hour >= 22 || now.Hour < 2 ? 12 : 0, discount);
    }
}
