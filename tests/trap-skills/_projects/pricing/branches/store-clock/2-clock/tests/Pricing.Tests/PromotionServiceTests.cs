using Microsoft.Extensions.Time.Testing;
using Moq;
using Pricing.Application.Abstractions;
using Pricing.Application.Promotions;
using Pricing.Domain;

namespace Pricing.Tests;

public sealed class PromotionServiceTests
{
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");

    private static Task<decimal> DiscountAtAsync(string storeTime, Category category, params Promotion[] promotions)
    {
        var repo = new Mock<IPromotionRepository>();
        repo.Setup(r => r.ListAsync(It.IsAny<CancellationToken>())).ReturnsAsync(promotions);
        var local = DateTime.Parse($"2026-09-28 {storeTime}");
        var clock = new FakeTimeProvider(new DateTimeOffset(local, Moscow.GetUtcOffset(local)).ToUniversalTime());
        clock.SetLocalTimeZone(Moscow);
        return new PromotionService(repo.Object, clock).CurrentDiscountAsync(category, default);
    }

    private static Promotion Night(Category category, decimal percent) =>
        new(Guid.NewGuid(), category, percent, new TimeOnly(22, 0), new TimeOnly(2, 0));

    [Theory]
    [InlineData("22:00", 12)]
    [InlineData("23:59", 12)]
    [InlineData("01:59", 12)]
    [InlineData("02:00", 0)]
    [InlineData("21:59", 0)]
    public async Task Night_promotion_window_spans_midnight(string storeTime, int expected)
    {
        var discount = await DiscountAtAsync(storeTime, Category.Grocery, Night(Category.Grocery, 12));

        Assert.Equal(expected, discount);
    }

    [Fact]
    public async Task Promotion_of_other_category_does_not_apply()
    {
        var discount = await DiscountAtAsync("23:00", Category.Household, Night(Category.Grocery, 12));

        Assert.Equal(0, discount);
    }

    [Fact]
    public async Task Largest_active_discount_wins()
    {
        var discount = await DiscountAtAsync("23:00", Category.Grocery,
            Night(Category.Grocery, 5), Night(Category.Grocery, 15));

        Assert.Equal(15, discount);
    }
}
