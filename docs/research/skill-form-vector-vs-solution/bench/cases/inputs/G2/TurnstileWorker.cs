using Microsoft.EntityFrameworkCore;

namespace FlowStudio.Schedule;

// Засчитывает посещения по проходам через турникет.
public class TurnstileWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TurnstileWorker> _log;

    public TurnstileWorker(IServiceScopeFactory scopeFactory, ILogger<TurnstileWorker> log)
    {
        _scopeFactory = scopeFactory;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<StudioDbContext>();

        while (!ct.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(db, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _log.LogError(ex, "Ошибка обработки проходов");
            }

            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }
    }

    private static async Task ProcessBatchAsync(StudioDbContext db, CancellationToken ct)
    {
        var passes = await db.TurnstilePasses
            .Where(p => p.ProcessedAt == null)
            .OrderBy(p => p.Id)
            .Take(200)
            .ToListAsync(ct);

        foreach (var pass in passes)
        {
            var member = await db.Members.FirstOrDefaultAsync(m => m.CardNumber == pass.CardNumber, ct);
            if (member is null)
            {
                pass.Note = "карта не найдена";
            }
            else
            {
                // Проход засчитывается за занятие, начавшееся не раньше чем за 1,5 часа
                // или начинающееся в ближайшие 30 минут.
                var from = pass.PassedAt.AddMinutes(-90);
                var to = pass.PassedAt.AddMinutes(30);

                var enrollment = await db.Enrollments
                    .Where(e => e.MemberId == member.Id
                        && e.Status == EnrollmentStatus.Booked
                        && e.Session.StartsAt >= from
                        && e.Session.StartsAt <= to)
                    .OrderBy(e => e.Session.StartsAt)
                    .FirstOrDefaultAsync(ct);

                if (enrollment is null)
                {
                    pass.Note = "нет записи на занятие";
                }
                else
                {
                    enrollment.Status = EnrollmentStatus.Attended;
                    enrollment.AttendedAt = pass.PassedAt;
                }
            }

            pass.ProcessedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
    }
}
