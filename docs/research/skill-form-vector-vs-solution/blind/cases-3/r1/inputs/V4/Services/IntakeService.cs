using System.ComponentModel.DataAnnotations;
using System.Globalization;
using HoneyCoop.Data;
using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Services;

public sealed class WeighingDto
{
    public long WeighingNo { get; set; }
    public int MemberId { get; set; }
    public int ContainerTypeId { get; set; }

    /// <summary>Вес брутто в формате прибора, кг.</summary>
    [Required, MaxLength(16)]
    public string Gross { get; set; } = "";

    [Range(0, 100)]
    public decimal MoisturePct { get; set; }

    public DateTimeOffset WeighedAt { get; set; }
}

public enum IntakeOutcome
{
    Accepted,
    Rejected,
    Duplicate,
    UnknownMember,
    UnknownContainer,
}

public sealed record IntakeResult(IntakeOutcome Outcome, int? BatchId = null, string? Reason = null);

public class IntakeService
{
    private const decimal GradeALimit = 18.5m;
    private const decimal GradeBLimit = 20m;

    private readonly CoopDbContext _db;

    public IntakeService(CoopDbContext db)
    {
        _db = db;
    }

    public async Task<IntakeResult> RegisterAsync(string terminalId, WeighingDto dto, CancellationToken ct)
    {
        if (await _db.Batches.AnyAsync(b => b.WeighingNo == dto.WeighingNo, ct))
            return new(IntakeOutcome.Duplicate);

        var member = await _db.Members.FindAsync(new object[] { dto.MemberId }, ct);
        if (member is null)
            return new(IntakeOutcome.UnknownMember, Reason: "Пчеловод с таким номером не найден");

        var container = await _db.ContainerTypes.FindAsync(new object[] { dto.ContainerTypeId }, ct);
        if (container is null)
            return new(IntakeOutcome.UnknownContainer, Reason: "Неизвестный тип тары");

        var gross = decimal.Parse(dto.Gross, CultureInfo.InvariantCulture);
        var net = gross - container.TareKg;
        var grade = GradeFor(dto.MoisturePct);

        var batch = new Batch
        {
            TerminalId = terminalId,
            WeighingNo = dto.WeighingNo,
            MemberId = member.Id,
            ContainerTypeId = container.Id,
            GrossKg = gross,
            NetKg = net,
            MoisturePct = dto.MoisturePct,
            Grade = grade,
            Status = grade is null ? BatchStatus.Rejected : BatchStatus.Accepted,
            AcceptedAt = dto.WeighedAt.UtcDateTime,
        };
        _db.Batches.Add(batch);
        await _db.SaveChangesAsync(ct);

        return grade is null
            ? new(IntakeOutcome.Rejected, batch.Id, "Влажность выше допустимой")
            : new(IntakeOutcome.Accepted, batch.Id);
    }

    private static HoneyGrade? GradeFor(decimal moisturePct) =>
        moisturePct < GradeALimit ? HoneyGrade.A
        : moisturePct <= GradeBLimit ? HoneyGrade.B
        : null;
}
