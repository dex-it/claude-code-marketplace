using GrantDesk.Data;
using GrantDesk.Models;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Services;

public sealed record RankingRow(
    int Place,
    int ApplicationId,
    string Title,
    string ApplicantName,
    decimal Score,
    int SubmittedReviews,
    decimal RequestedAmount,
    bool Funded);

public class RankingService
{
    public const int MinReviews = 3;

    private readonly GrantsDbContext _db;

    public RankingService(GrantsDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<RankingRow>?> BuildAsync(int contestId, CancellationToken ct)
    {
        var contest = await _db.Contests.AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == contestId, ct);
        if (contest is null)
            return null;

        var rows = await _db.Applications.AsNoTracking()
            .Where(a => a.ContestId == contestId && a.Status == ApplicationStatus.Submitted)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.ApplicantName,
                a.RequestedAmount,
                a.CreatedAt,
                SubmittedReviews = a.Reviews.Count(r => r.Status == ReviewStatus.Submitted),
                Score = a.Reviews
                    .Where(r => r.Status == ReviewStatus.Submitted)
                    .Average(r => (decimal?)r.Total) ?? 0m,
            })
            .Where(x => x.SubmittedReviews >= MinReviews)
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.CreatedAt)
            .ToListAsync(ct);

        var remaining = contest.Budget;
        var result = new List<RankingRow>(rows.Count);

        foreach (var x in rows)
        {
            var funded = x.RequestedAmount <= remaining;
            if (funded)
                remaining -= x.RequestedAmount;

            result.Add(new RankingRow(
                result.Count + 1,
                x.Id,
                x.Title,
                x.ApplicantName,
                Math.Round(x.Score, 2, MidpointRounding.AwayFromZero),
                x.SubmittedReviews,
                x.RequestedAmount,
                funded));
        }

        return result;
    }
}
