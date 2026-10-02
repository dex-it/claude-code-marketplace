using HoneyCoop.Contracts;
using HoneyCoop.Data;
using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Services;

public enum IntakeOutcome
{
    Accepted,
    Rejected,
    Duplicate,
    NotFound,
    UnknownMember,
    UnknownHoneyType,
    UnknownContainer,
    InvalidWeight,
}

public sealed record IntakeResult(IntakeOutcome Outcome, Batch? Batch = null, string? Reason = null);

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
        var existing = await _db.Batches.AsNoTracking()
            .SingleOrDefaultAsync(b => b.TerminalId == terminalId && b.WeighingNo == dto.WeighingNo, ct);
        if (existing is not null)
            return new(IntakeOutcome.Duplicate, existing);

        var batch = new Batch
        {
            TerminalId = terminalId,
            WeighingNo = dto.WeighingNo,
            AcceptedAt = dto.WeighedAt.UtcDateTime,
            AcceptedOn = DateOnly.FromDateTime(dto.WeighedAt.DateTime),
        };

        var error = await ApplyAsync(batch, dto, ct);
        if (error is not null)
            return error;

        _db.Batches.Add(batch);
        await _db.SaveChangesAsync(ct);

        return Result(batch);
    }

    public async Task<IntakeResult> CorrectAsync(string terminalId, long weighingNo, CorrectionDto dto, CancellationToken ct)
    {
        var batch = await _db.Batches
            .SingleOrDefaultAsync(b => b.TerminalId == terminalId && b.WeighingNo == weighingNo, ct);
        if (batch is null)
            return new(IntakeOutcome.NotFound, Reason: "Взвешивание не найдено");

        var error = await ApplyAsync(batch, dto, ct);
        if (error is not null)
            return error;

        batch.CorrectedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return Result(batch);
    }

    /// <summary>Проверяет данные взвешивания и заполняет по ним партию.</summary>
    private async Task<IntakeResult?> ApplyAsync(Batch batch, WeighingData data, CancellationToken ct)
    {
        if (!await _db.Members.AnyAsync(m => m.Id == data.MemberId, ct))
            return new(IntakeOutcome.UnknownMember, Reason: "Пчеловод с таким номером не найден");
        if (!await _db.HoneyTypes.AnyAsync(h => h.Id == data.HoneyTypeId, ct))
            return new(IntakeOutcome.UnknownHoneyType, Reason: "Неизвестный вид мёда");

        var container = await _db.ContainerTypes.AsNoTracking()
            .SingleOrDefaultAsync(c => c.Id == data.ContainerTypeId, ct);
        if (container is null)
            return new(IntakeOutcome.UnknownContainer, Reason: "Неизвестный тип тары");

        if (!WeightParser.TryParseKg(data.Gross, out var gross))
            return new(IntakeOutcome.InvalidWeight, Reason: $"Не удалось разобрать вес «{data.Gross}»");

        var net = gross - container.TareKg;
        if (net <= 0)
            return new(IntakeOutcome.InvalidWeight, Reason: "Вес брутто меньше массы тары");

        var grade = GradeFor(data.MoisturePct);

        batch.MemberId = data.MemberId;
        batch.HoneyTypeId = data.HoneyTypeId;
        batch.ContainerTypeId = container.Id;
        batch.ContainerCount = data.ContainerCount;
        batch.GrossKg = gross;
        batch.NetKg = net;
        batch.MoisturePct = data.MoisturePct;
        batch.Grade = grade;
        batch.Status = grade is null ? BatchStatus.Rejected : BatchStatus.Accepted;
        return null;
    }

    private static HoneyGrade? GradeFor(decimal moisturePct) =>
        moisturePct <= GradeALimit ? HoneyGrade.A
        : moisturePct <= GradeBLimit ? HoneyGrade.B
        : null;

    private static IntakeResult Result(Batch batch) =>
        batch.Grade is null
            ? new(IntakeOutcome.Rejected, batch, "Влажность выше допустимой")
            : new(IntakeOutcome.Accepted, batch);
}
