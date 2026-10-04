using ConfReg.Data;
using ConfReg.Models;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Services;

public class CapacityService
{
    private readonly ConfDbContext _db;

    public CapacityService(ConfDbContext db)
    {
        _db = db;
    }

    /// <summary>Сколько мест ещё свободно. Вызывать под блокировкой строки конференции.</summary>
    public async Task<int> FreeSeatsAsync(Conference conference, CancellationToken ct)
    {
        var taken = await _db.Registrations
            .CountAsync(r => r.ConferenceId == conference.Id && r.Status != RegistrationStatus.Cancelled, ct);

        return Math.Max(0, conference.Capacity - taken);
    }

    /// <summary>Блокирует строку конференции до конца транзакции, чтобы места не продавались параллельно.</summary>
    public Task<Conference?> LockConferenceAsync(int conferenceId, CancellationToken ct) =>
        _db.Conferences
            .FromSql($"""SELECT * FROM "Conferences" WHERE "Id" = {conferenceId} FOR UPDATE""")
            .SingleOrDefaultAsync(ct);
}
