using Pricing.Application.Abstractions;
using Pricing.Domain;

namespace Pricing.Application.Promotions;

public sealed class PromotionService(IPromotionRepository promotions)
{
    /// <summary>Наибольшая скидка категории, действующая сейчас; 0 - акции нет.</summary>
    public async Task<decimal> CurrentDiscountAsync(Category category, CancellationToken ct)
    {
        var now = TimeOnly.FromDateTime(DateTime.Now);
        var all = await promotions.ListAsync(ct);
        return all
            .Where(p => p.Category == category && IsActive(p, now))
            .Select(p => p.DiscountPercent)
            .DefaultIfEmpty(0m)
            .Max();
    }

    // Окно акции может переходить через полночь: 22:00-02:00.
    private static bool IsActive(Promotion p, TimeOnly now) =>
        p.From <= p.To ? now >= p.From && now < p.To : now >= p.From || now < p.To;
}
