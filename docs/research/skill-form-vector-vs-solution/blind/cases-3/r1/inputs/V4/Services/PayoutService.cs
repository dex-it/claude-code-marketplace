using HoneyCoop.Data;
using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Services;

public enum ApproveResult
{
    Approved,
    NotFound,
    AlreadyApproved,
}

public class PayoutService
{
    private const decimal FeeRate = 0.03m;

    private readonly CoopDbContext _db;

    public PayoutService(CoopDbContext db)
    {
        _db = db;
    }

    /// <summary>Рассчитывает выплату пчеловоду за месяц. Возвращает null, если выплата за месяц уже есть.</summary>
    public async Task<Payout?> CalculateAsync(int memberId, int year, int month, string accountantId, CancellationToken ct)
    {
        if (await _db.Payouts.AnyAsync(p => p.MemberId == memberId && p.Year == year && p.Month == month, ct))
            return null;

        var member = await _db.Members.SingleAsync(m => m.Id == memberId, ct);

        var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var to = new DateTime(year, month, DateTime.DaysInMonth(year, month), 0, 0, 0, DateTimeKind.Utc);

        var batches = await _db.Batches
            .Where(b => b.MemberId == memberId
                        && b.Status == BatchStatus.Accepted
                        && b.PayoutId == null
                        && b.AcceptedAt >= from
                        && b.AcceptedAt <= to)
            .ToListAsync(ct);

        var prices = await PricesOnAsync(DateOnly.FromDateTime(DateTime.UtcNow), ct);

        var gross = batches.Sum(b =>
            Math.Round(b.NetKg * prices[b.Grade!.Value], 2, MidpointRounding.AwayFromZero));
        var fee = Math.Round(gross * FeeRate, 2, MidpointRounding.AwayFromZero);
        var due = gross - fee;

        var net = Math.Max(0m, due - member.AdvanceBalance);
        var withheld = due - net;
        member.AdvanceBalance = 0;

        var payout = new Payout
        {
            MemberId = member.Id,
            Year = year,
            Month = month,
            GrossAmount = gross,
            Fee = fee,
            AdvanceWithheld = withheld,
            NetAmount = net,
            Status = PayoutStatus.Draft,
            CreatedBy = accountantId,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Payouts.Add(payout);

        foreach (var batch in batches)
        {
            batch.PayoutId = payout.Id;
            batch.Status = BatchStatus.InPayout;
        }

        await _db.SaveChangesAsync(ct);
        return payout;
    }

    public async Task<ApproveResult> ApproveAsync(int payoutId, string accountantId, CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var payout = await _db.Payouts.SingleOrDefaultAsync(p => p.Id == payoutId, ct);
        if (payout is null)
            return ApproveResult.NotFound;
        if (payout.Status != PayoutStatus.Draft)
            return ApproveResult.AlreadyApproved;

        payout.Status = PayoutStatus.Approved;
        payout.ApprovedBy = accountantId;
        payout.ApprovedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _db.Batches
            .Where(b => b.PayoutId == payoutId)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BatchStatus.Paid), ct);

        await tx.CommitAsync(ct);
        return ApproveResult.Approved;
    }

    private async Task<Dictionary<HoneyGrade, decimal>> PricesOnAsync(DateOnly date, CancellationToken ct)
    {
        var entries = await _db.PriceList.AsNoTracking()
            .Where(p => p.ValidFrom <= date)
            .ToListAsync(ct);

        return entries
            .GroupBy(p => p.Grade)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.ValidFrom).First().PricePerKg);
    }
}
