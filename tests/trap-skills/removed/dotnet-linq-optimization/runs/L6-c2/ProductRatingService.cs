using Microsoft.EntityFrameworkCore;

namespace Shop;

public record ProductRatingResult(double AverageScore, int MinScore, int MaxScore, string TopReviewText);

public class ProductRatingService
{
    private readonly ShopDbContext _db;
    public ProductRatingService(ShopDbContext db) => _db = db;

    // null - у продукта нет одобренных отзывов, среднее/min/max не определены.
    public async Task<ProductRatingResult?> GetRating(Guid productId, CancellationToken ct = default)
    {
        var approved = _db.Reviews.Where(r => r.ProductId == productId && r.Approved);

        var stats = await approved
            .GroupBy(r => 1)
            .Select(g => new
            {
                Average = g.Average(r => (double)r.Score),
                Min = g.Min(r => r.Score),
                Max = g.Max(r => r.Score)
            })
            .FirstOrDefaultAsync(ct);

        if (stats is null)
            return null;

        // Ties по Max разрешаем детерминированно по Id, не порядком СУБД.
        var topReviewText = await approved
            .Where(r => r.Score == stats.Max)
            .OrderBy(r => r.Id)
            .Select(r => r.Text)
            .FirstAsync(ct);

        return new ProductRatingResult(stats.Average, stats.Min, stats.Max, topReviewText);
    }
}
