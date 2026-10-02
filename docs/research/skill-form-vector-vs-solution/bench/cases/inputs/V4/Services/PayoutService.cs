using HoneyCoop.Contracts;
using HoneyCoop.Data;
using HoneyCoop.Models;
using Microsoft.EntityFrameworkCore;

namespace HoneyCoop.Services;

public enum PayoutError
{
    None,
    NotFound,
    AlreadyExists,
    NoBatches,
    MissingPrice,
    NotDraft,
    NegativeAmount,
    SameAccountant,
}

public sealed record PayoutResult(PayoutError Error, Payout? Payout = null);

public class PayoutService
{
    private const decimal FeeRate = 0.03m;

    private readonly CoopDbContext _db;

    public PayoutService(CoopDbContext db)
    {
        _db = db;
    }

    public async Task<PayoutResult> CalculateAsync(int memberId, int year, int month, string accountantId, CancellationToken ct)
    {
        if (await _db.Payouts.AnyAsync(p => p.MemberId == memberId && p.Year == year && p.Month == month, ct))
            return new(PayoutError.AlreadyExists);

        var member = await _db.Members.SingleOrDefaultAsync(m => m.Id == memberId, ct);
        if (member is null)
            return new(PayoutError.NotFound);

        var firstDay = new DateOnly(year, month, 1);
        var nextMonth = firstDay.AddMonths(1);

        var batches = await _db.Batches
            .Where(b => b.MemberId == memberId
                        && b.Status == BatchStatus.Accepted
                        && b.PayoutId == null
                        && b.AcceptedOn >= firstDay
                        && b.AcceptedOn < nextMonth)
            .ToListAsync(ct);
        if (batches.Count == 0)
            return new(PayoutError.NoBatches);

        var prices = await _db.PriceList.AsNoTracking().ToListAsync(ct);

        decimal gross = 0;
        foreach (var batch in batches)
        {
            var price = prices
                .Where(p => p.Grade == batch.Grade && p.ValidFrom <= batch.AcceptedOn)
                .MaxBy(p => p.ValidFrom);
            if (price is null)
                return new(PayoutError.MissingPrice);

            gross += Math.Round(batch.NetKg * price.PricePerKg, 2, MidpointRounding.AwayFromZero);
        }

        var fee = Math.Round(gross * FeeRate, 2, MidpointRounding.AwayFromZero);
        var due = gross - fee;
        var withheld = Math.Min(due, member.AdvanceBalance);
        member.AdvanceBalance -= withheld;

        var payout = new Payout
        {
            MemberId = member.Id,
            Year = year,
            Month = month,
            GrossAmount = gross,
            Fee = fee,
            AdvanceWithheld = withheld,
            Status = PayoutStatus.Draft,
            CreatedBy = accountantId,
            CreatedAt = DateTime.UtcNow,
        };
        payout.RecalculateNet();

        foreach (var batch in batches)
        {
            batch.Status = BatchStatus.InPayout;
            payout.Batches.Add(batch);
        }

        _db.Payouts.Add(payout);
        await _db.SaveChangesAsync(ct);
        return new(PayoutError.None, payout);
    }

    public async Task<PayoutResult> AdjustAsync(int payoutId, AdjustPayoutRequest req, CancellationToken ct)
    {
        var payout = await _db.Payouts.SingleOrDefaultAsync(p => p.Id == payoutId, ct);
        if (payout is null)
            return new(PayoutError.NotFound);
        if (payout.Status != PayoutStatus.Draft)
            return new(PayoutError.NotDraft);

        payout.Bonus = req.Bonus;
        payout.OtherDeductions = req.OtherDeductions;
        payout.AdjustmentNote = req.Note;
        payout.RecalculateNet();
        if (payout.NetAmount < 0)
            return new(PayoutError.NegativeAmount);

        await _db.SaveChangesAsync(ct);
        return new(PayoutError.None, payout);
    }

    /// <summary>Удаляет черновик, чтобы посчитать выплату заново. Партии возвращаются в принятые.</summary>
    public async Task<PayoutResult> DeleteDraftAsync(int payoutId, CancellationToken ct)
    {
        var payout = await _db.Payouts
            .Include(p => p.Batches)
            .SingleOrDefaultAsync(p => p.Id == payoutId, ct);
        if (payout is null)
            return new(PayoutError.NotFound);
        if (payout.Status != PayoutStatus.Draft)
            return new(PayoutError.NotDraft);

        foreach (var batch in payout.Batches)
        {
            batch.Status = BatchStatus.Accepted;
            batch.PayoutId = null;
        }

        _db.Payouts.Remove(payout);
        await _db.SaveChangesAsync(ct);
        return new(PayoutError.None);
    }

    public async Task<PayoutResult> ApproveAsync(int payoutId, string accountantId, CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);

        var payout = await _db.Payouts.SingleOrDefaultAsync(p => p.Id == payoutId, ct);
        if (payout is null)
            return new(PayoutError.NotFound);
        if (payout.Status != PayoutStatus.Draft)
            return new(PayoutError.NotDraft);
        if (payout.CreatedBy == accountantId)
            return new(PayoutError.SameAccountant);

        payout.Status = PayoutStatus.Approved;
        payout.ApprovedBy = accountantId;
        payout.ApprovedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        await _db.Batches
            .Where(b => b.PayoutId == payoutId)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BatchStatus.Paid), ct);

        await tx.CommitAsync(ct);
        return new(PayoutError.None, payout);
    }
}
