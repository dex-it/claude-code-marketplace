using Microsoft.EntityFrameworkCore;

namespace Aqualab.Samples;

public class SampleRepository
{
    private readonly LabDbContext _db;

    public SampleRepository(LabDbContext db) => _db = db;

    public Task<Sample?> FindByLabCodeAsync(string labCode) =>
        _db.Samples
            .Include(s => s.Tags)
            .SingleOrDefaultAsync(s => s.LabCode == labCode);

    public Task<List<Sample>> GetInAnalysisForBatchAsync(int batchId) =>
        _db.Samples
            .Include(s => s.Results)
            .Where(s => s.BatchId == batchId && s.Status == SampleStatus.InAnalysis)
            .ToListAsync();

    // Пробы объекта за последние N дней - для карточки объекта.
    public Task<List<Sample>> GetRecentBySiteAsync(string siteCode, int days)
    {
        var since = DateTime.UtcNow.Date.AddDays(-days);
        return _db.Samples
            .FromSql($"""
                SELECT s.* FROM samples s
                JOIN sites t ON t.id = s.site_id
                WHERE t.code = {siteCode} AND s.collected_at >= {since}
                """)
            .AsNoTracking()
            .OrderByDescending(s => s.CollectedAt)
            .ToListAsync();
    }
}
