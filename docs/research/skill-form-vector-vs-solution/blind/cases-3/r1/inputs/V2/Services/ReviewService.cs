using System.ComponentModel.DataAnnotations;
using GrantDesk.Data;
using GrantDesk.Models;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Services;

public sealed class ScoreItem
{
    public int CriterionId { get; set; }

    [Range(0, 10)]
    public int Value { get; set; }
}

public sealed class SaveReviewRequest
{
    [Required, MinLength(1)]
    public List<ScoreItem> Scores { get; set; } = new();

    [MaxLength(4000)]
    public string? Comment { get; set; }
}

public enum SaveReviewResult
{
    Saved,
    NotFound,
    AlreadySubmitted,
    ReviewClosed,
    Invalid,
}

public class ReviewService
{
    private readonly GrantsDbContext _db;

    public ReviewService(GrantsDbContext db)
    {
        _db = db;
    }

    public async Task<SaveReviewResult> SaveAsync(
        int reviewId, string expertId, SaveReviewRequest req, bool submit, CancellationToken ct)
    {
        var review = await _db.Reviews
            .Include(r => r.Scores)
            .Include(r => r.Application)
                .ThenInclude(a => a.Contest)
                .ThenInclude(c => c.Criteria)
            .SingleOrDefaultAsync(r => r.Id == reviewId, ct);

        // Эксперт не оценивает заявку, которую подал сам.
        if (review is null || review.Application.ApplicantId == expertId)
            return SaveReviewResult.NotFound;
        if (review.Status == ReviewStatus.Submitted)
            return SaveReviewResult.AlreadySubmitted;
        if (review.Status == ReviewStatus.Expired || review.Application.Contest.ReviewClosed)
            return SaveReviewResult.ReviewClosed;

        var criteria = review.Application.Contest.Criteria.ToDictionary(c => c.Id);

        if (req.Scores.Any(s => !criteria.ContainsKey(s.CriterionId)))
            return SaveReviewResult.Invalid;
        if (req.Scores.GroupBy(s => s.CriterionId).Any(g => g.Count() > 1))
            return SaveReviewResult.Invalid;
        if (submit && criteria.Keys.Any(id => req.Scores.All(s => s.CriterionId != id)))
            return SaveReviewResult.Invalid;

        review.Scores = req.Scores
            .Select(s => new ReviewScore { CriterionId = s.CriterionId, Value = s.Value })
            .ToList();
        review.Comment = req.Comment;
        review.Total = CalculateTotal(review.Scores, criteria);
        review.Status = submit ? ReviewStatus.Submitted : ReviewStatus.Draft;
        if (submit)
            review.SubmittedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return SaveReviewResult.Saved;
    }

    private static decimal CalculateTotal(IEnumerable<ReviewScore> scores, IReadOnlyDictionary<int, Criterion> criteria)
    {
        var totalWeight = criteria.Values.Sum(c => c.Weight);
        var weighted = scores.Sum(s =>
        {
            var c = criteria[s.CriterionId];
            return (decimal)s.Value / c.MaxScore * c.Weight;
        });
        return Math.Round(weighted / totalWeight * 100m, 2, MidpointRounding.AwayFromZero);
    }
}
