using GrantDesk.Contracts;
using GrantDesk.Data;
using GrantDesk.Models;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Services;

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

    public async Task<ReviewDetailsDto?> GetMineAsync(int reviewId, string expertId, CancellationToken ct)
    {
        return await _db.Reviews.AsNoTracking()
            .Where(r => r.Id == reviewId && r.ExpertId == expertId)
            .Select(r => new ReviewDetailsDto(
                r.Id,
                r.ApplicationId,
                r.Application.Title,
                r.Status,
                r.Scores.OrderBy(s => s.CriterionId).Select(s => new ScoreDto(s.CriterionId, s.Value)).ToList(),
                r.Comment,
                r.Total))
            .SingleOrDefaultAsync(ct);
    }

    public async Task<SaveReviewResult> SaveAsync(
        int reviewId, string expertId, SaveReviewRequest req, bool submit, CancellationToken ct)
    {
        var review = await _db.Reviews
            .Include(r => r.Scores)
            .Include(r => r.Application)
                .ThenInclude(a => a.Contest)
                .ThenInclude(c => c.Criteria)
            .SingleOrDefaultAsync(r => r.Id == reviewId && r.ExpertId == expertId, ct);

        if (review is null)
            return SaveReviewResult.NotFound;
        if (review.Status == ReviewStatus.Submitted)
            return SaveReviewResult.AlreadySubmitted;

        var contest = review.Application.Contest;
        if (review.Status == ReviewStatus.Expired || !contest.AcceptsReviews(DateTime.UtcNow))
            return SaveReviewResult.ReviewClosed;

        var criteria = contest.Criteria.ToDictionary(c => c.Id);

        if (req.Scores.Any(s => !criteria.TryGetValue(s.CriterionId, out var c) || s.Value > c.MaxScore))
            return SaveReviewResult.Invalid;
        if (req.Scores.GroupBy(s => s.CriterionId).Any(g => g.Count() > 1))
            return SaveReviewResult.Invalid;
        if (submit && criteria.Keys.Any(id => req.Scores.All(s => s.CriterionId != id)))
            return SaveReviewResult.Invalid;

        review.Scores = req.Scores
            .Select(s => new ReviewScore { CriterionId = s.CriterionId, Value = s.Value })
            .ToList();
        review.Comment = req.Comment;
        review.Total = ScoreCalculator.Total(review.Scores, criteria);
        review.Status = submit ? ReviewStatus.Submitted : ReviewStatus.Draft;
        if (submit)
            review.SubmittedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return SaveReviewResult.Saved;
    }
}
