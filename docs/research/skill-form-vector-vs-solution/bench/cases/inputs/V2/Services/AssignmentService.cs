using GrantDesk.Contracts;
using GrantDesk.Data;
using GrantDesk.Models;
using Microsoft.EntityFrameworkCore;

namespace GrantDesk.Services;

public enum AssignStatus
{
    Done,
    ExpertNotFound,
    ApplicationsNotFound,
    ConflictOfInterest,
    AlreadyAssigned,
}

public sealed record AssignResult(AssignStatus Status, int Count = 0, IReadOnlyList<int>? ApplicationIds = null);

public class AssignmentService
{
    private readonly GrantsDbContext _db;

    public AssignmentService(GrantsDbContext db)
    {
        _db = db;
    }

    public async Task<AssignResult> AssignAsync(int contestId, AssignRequest req, CancellationToken ct)
    {
        var expert = await _db.Experts.AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == req.ExpertId && e.Active, ct);
        if (expert is null)
            return new(AssignStatus.ExpertNotFound);

        var ids = req.ApplicationIds.Distinct().ToList();
        var applications = await _db.Applications.AsNoTracking()
            .Where(a => a.ContestId == contestId
                        && a.Status == ApplicationStatus.Submitted
                        && ids.Contains(a.Id))
            .ToListAsync(ct);
        if (applications.Count != ids.Count)
            return new(AssignStatus.ApplicationsNotFound);

        var conflicts = ConflictOfInterest.Find(expert, applications);
        if (conflicts.Count > 0)
            return new(AssignStatus.ConflictOfInterest, ApplicationIds: conflicts);

        var alreadyAssigned = await _db.Reviews
            .Where(r => r.ExpertId == expert.Id && ids.Contains(r.ApplicationId))
            .Select(r => r.ApplicationId)
            .ToListAsync(ct);

        var added = 0;
        foreach (var app in applications.Where(a => !alreadyAssigned.Contains(a.Id)))
        {
            _db.Reviews.Add(new Review
            {
                ApplicationId = app.Id,
                ExpertId = expert.Id,
                ExpertName = expert.FullName,
                Status = ReviewStatus.Assigned,
            });
            added++;
        }

        await _db.SaveChangesAsync(ct);
        return new(AssignStatus.Done, added);
    }

    /// <summary>Передаёт неотправленные назначения выбывшего эксперта другому.</summary>
    public async Task<AssignResult> ReassignAsync(int contestId, ReassignRequest req, CancellationToken ct)
    {
        var toExpert = await _db.Experts.AsNoTracking()
            .SingleOrDefaultAsync(e => e.Id == req.ToExpertId && e.Active, ct);
        if (toExpert is null || req.ToExpertId == req.FromExpertId)
            return new(AssignStatus.ExpertNotFound);

        var reviews = await _db.Reviews
            .Include(r => r.Application)
            .Where(r => r.ExpertId == req.FromExpertId
                        && r.Application.ContestId == contestId
                        && (r.Status == ReviewStatus.Assigned || r.Status == ReviewStatus.Draft))
            .ToListAsync(ct);

        var conflicts = ConflictOfInterest.Find(toExpert, reviews.Select(r => r.Application));
        if (conflicts.Count > 0)
            return new(AssignStatus.ConflictOfInterest, ApplicationIds: conflicts);

        var applicationIds = reviews.Select(r => r.ApplicationId).ToList();
        var overlap = await _db.Reviews
            .Where(r => r.ExpertId == toExpert.Id && applicationIds.Contains(r.ApplicationId))
            .Select(r => r.ApplicationId)
            .ToListAsync(ct);
        if (overlap.Count > 0)
            return new(AssignStatus.AlreadyAssigned, ApplicationIds: overlap);

        foreach (var review in reviews)
        {
            review.ExpertId = toExpert.Id;
            review.ExpertName = toExpert.FullName;
        }

        await _db.SaveChangesAsync(ct);
        return new(AssignStatus.Done, reviews.Count);
    }
}
