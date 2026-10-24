using Microsoft.EntityFrameworkCore;

namespace Shop;

public record ProductRating(double AverageScore, int MinScore, int MaxScore, string TopReviewText);

public class ProductRatingService
{
    private readonly ShopDbContext _db;
    public ProductRatingService(ShopDbContext db) => _db = db;

    public async Task<ProductRating?> GetRating(Guid productId, CancellationToken ct = default)
    {
        var approved = _db.Reviews.Where(r => r.ProductId == productId && r.Approved);

        // GroupBy(_ => 1) сводит три агрегата в один SQL-запрос вместо трёх отдельных round-trip'ов.
        var stats = await approved
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Average = g.Average(r => r.Score),
                Min = g.Min(r => r.Score),
                Max = g.Max(r => r.Score)
            })
            .SingleOrDefaultAsync(ct);

        if (stats is null) return null;

        // При нескольких отзывах с максимальной оценкой тай-брейк по Id - детерминированный выбор.
        var topText = await approved
            .Where(r => r.Score == stats.Max)
            .OrderBy(r => r.Id)
            .Select(r => r.Text)
            .FirstAsync(ct);

        return new ProductRating(stats.Average, stats.Min, stats.Max, topText);
    }
}
