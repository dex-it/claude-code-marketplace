using GrantDesk.Data;
using GrantDesk.Models;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Services;

public sealed record RankingRow(
    int ApplicationId,
    string Title,
    string ApplicantName,
    decimal Score,
    int SubmittedReviews,
    decimal RequestedAmount,
    bool Funded);

public class RankingService
{
    private const int MinReviews = 3;

    private readonly GrantsDbContext _db;

    public RankingService(GrantsDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<RankingRow>> BuildAsync(int contestId, CancellationToken ct)
    {
        var contestTask = _db.Contests.AsNoTracking()
            .SingleAsync(c => c.Id == contestId, ct);

        var rowsTask = _db.Applications.AsNoTracking()
            .Where(a => a.ContestId == contestId && a.Status == ApplicationStatus.Submitted)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.ApplicantName,
                a.RequestedAmount,
                a.SubmittedAt,
                SubmittedReviews = a.Reviews.Count(r => r.Status == ReviewStatus.Submitted),
                Score = a.Reviews.Average(r => (decimal?)r.Total) ?? 0m,
            })
            .Where(x => x.SubmittedReviews > MinReviews)
            .OrderByDescending(x => x.Score)
            .ThenBy(x => x.SubmittedAt)
            .ToListAsync(ct);

        await Task.WhenAll(contestTask, rowsTask);
        var contest = contestTask.Result;
        var rows = rowsTask.Result;

        var remaining = contest.Budget;
        var budgetExhausted = false;
        var result = new List<RankingRow>(rows.Count);

        foreach (var x in rows)
        {
            var funded = !budgetExhausted && x.RequestedAmount <= remaining;
            if (funded)
                remaining -= x.RequestedAmount;
            else
                budgetExhausted = true;

            result.Add(new RankingRow(
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
