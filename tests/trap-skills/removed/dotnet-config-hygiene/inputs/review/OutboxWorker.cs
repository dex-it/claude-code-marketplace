using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Notify.Worker.Options;

namespace Notify.Worker;

public class OutboxWorker(
    IServiceScopeFactory scopes,
    IMailSender sender,
    ThrottleService throttle,
    IOptions<OutboxOptions> options,
    ILogger<OutboxWorker> log) : BackgroundService
{
    private int _batchSize;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _batchSize = options.Value.MaxBatchSize;

        while (!ct.IsCancellationRequested)
        {
            var o = options.Value;
            var sent = await ProcessBatchAsync(o, ct);

            if (o.MinBatchSize < o.MaxBatchSize)
            {
                // adaptive batching: shrink when the outbox is nearly empty, grow under backlog
                _batchSize = sent < _batchSize / 2
                    ? Math.Max(o.MinBatchSize, _batchSize / 2)
                    : Math.Min(o.MaxBatchSize, _batchSize * 2);
            }

            await Task.Delay(TimeSpan.FromSeconds(o.PollInterval), ct);
        }
    }

    private async Task<int> ProcessBatchAsync(OutboxOptions o, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NotifyDbContext>();
        var now = DateTime.UtcNow;

        var batch = await db.Outbox
            .Where(m => m.SentAt == null && m.Attempts < o.MaxRetries
                        && (m.LockedUntil == null || m.LockedUntil < now))
            .OrderBy(m => m.CreatedAt)
            .Take(_batchSize)
            .ToListAsync(ct);

        foreach (var m in batch)
        {
            m.LockedUntil = now + o.LockTimeout;
            m.SentAt = now;
        }
        await db.SaveChangesAsync(ct);

        using var gate = new SemaphoreSlim(o.MaxInFlight);
        var tasks = batch.Select(async m =>
        {
            await gate.WaitAsync(ct);
            try
            {
                await throttle.WaitAsync(ct);
                await sender.SendAsync(m.To, m.Subject, m.Body, ct);
            }
            catch (Exception ex)
            {
                m.Attempts++;
                log.LogWarning(ex, "Send failed for {Id}", m.Id);
            }
            finally
            {
                gate.Release();
            }
        });
        await Task.WhenAll(tasks);
        await db.SaveChangesAsync(ct);

        return batch.Count;
    }
}
