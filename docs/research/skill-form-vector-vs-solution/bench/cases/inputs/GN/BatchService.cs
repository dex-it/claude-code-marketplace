using Microsoft.EntityFrameworkCore;

namespace Aqualab.Samples;

public record BatchCard(int Id, string Number, DateTime CreatedAt, DateTime? ClosedAt,
    IReadOnlyList<string> Instruments, IReadOnlyList<BatchSampleLine> Samples);

public record BatchSampleLine(string LabCode, SampleStatus Status, int ResultCount, bool AnyExceeded);

public record BatchListItem(int Id, string Number, DateTime CreatedAt, bool Closed);

public class BatchService
{
    private readonly LabDbContext _db;
    private readonly SampleRepository _samples;

    public BatchService(LabDbContext db, SampleRepository samples)
    {
        _db = db;
        _samples = samples;
    }

    public async Task<BatchCard?> GetCardAsync(int batchId)
    {
        var batch = await _db.Batches
            .AsNoTracking()
            .AsSplitQuery()
            .Include(b => b.Instruments)
            .Include(b => b.Samples).ThenInclude(s => s.Results)
            .SingleOrDefaultAsync(b => b.Id == batchId);

        if (batch is null)
            return null;

        return new BatchCard(batch.Id, batch.Number, batch.CreatedAt, batch.ClosedAt,
            batch.Instruments.Select(i => i.InstrumentCode).ToList(),
            batch.Samples
                .Select(s => new BatchSampleLine(s.LabCode, s.Status, s.Results.Count,
                    s.Results.Any(r => r.Value > r.Limit)))
                .ToList());
    }

    /// <param name="page">Номер страницы, начиная с 1.</param>
    public async Task<List<BatchListItem>> ListAsync(int page, int pageSize = 20)
    {
        return await _db.Batches
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedAt).ThenByDescending(b => b.Id)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(b => new BatchListItem(b.Id, b.Number, b.CreatedAt, b.ClosedAt != null))
            .ToListAsync();
    }

    // Закрытие партии: все пробы в анализе переводятся в Done, партия получает дату отчёта.
    public async Task CloseAsync(int batchId)
    {
        var batch = await _db.Batches.FirstOrDefaultAsync(b => b.Id == batchId)
            ?? throw new KeyNotFoundException();

        var samples = await _samples.GetInAnalysisForBatchAsync(batchId);
        if (samples.Any(s => s.Results.Count == 0))
            throw new InvalidOperationException("Есть пробы без результатов");

        foreach (var s in samples)
            s.Status = SampleStatus.Done;

        batch.ClosedAt = DateTime.UtcNow;
        batch.ReportDate = DateTime.UtcNow.Date;
        await _db.SaveChangesAsync();
    }

    public async Task<int> PlanSampleAsync(int siteId, string labCode, DateOnly day, TimeOnly time)
    {
        var sample = new Sample
        {
            SiteId = siteId,
            LabCode = labCode,
            Status = SampleStatus.Planned,
            PlannedLocal = day.ToDateTime(time),
        };
        _db.Samples.Add(sample);
        await _db.SaveChangesAsync();
        return sample.Id;
    }

    // Переразметка пробы: лаборант присылает итоговый набор тегов.
    public async Task RetagAsync(string labCode, IReadOnlyCollection<string> tags)
    {
        var sample = await _samples.FindByLabCodeAsync(labCode)
            ?? throw new KeyNotFoundException();

        sample.Tags.Clear();
        foreach (var tag in tags.Select(t => t.Trim().ToLowerInvariant()).Distinct())
            sample.Tags.Add(new SampleTag { Tag = tag });

        await _db.SaveChangesAsync();
    }

    // Доля проб партии, у которых все показатели в норме, %.
    public async Task<int> CompliancePercentAsync(int batchId)
    {
        var total = await _db.Samples.CountAsync(s => s.BatchId == batchId);
        var compliant = await _db.Samples
            .CountAsync(s => s.BatchId == batchId && s.Results.All(r => r.Value <= r.Limit));

        return compliant / total * 100;
    }
}
