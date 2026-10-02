using ConfReg.Data;
using ConfReg.Models;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Services;

public class PricingService
{
    private static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");

    private readonly ConfDbContext _db;

    public PricingService(ConfDbContext db)
    {
        _db = db;
    }

    /// <summary>Сегодняшняя дата по Москве: сроки тарифов и промокодов считаются по московскому времени.</summary>
    public static DateOnly Today() =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Moscow));

    public async Task<PromoCode?> FindPromoAsync(int conferenceId, string code, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return await _db.PromoCodes.AsNoTracking()
            .SingleOrDefaultAsync(p => p.ConferenceId == conferenceId && p.Code == normalized, ct);
    }

    public static string? WhyUnusable(PromoCode promo, DateOnly today) =>
        promo.ValidUntil < today ? "Срок действия промокода истёк"
        : promo.UsedCount >= promo.UsageLimit ? "Промокод исчерпан"
        : null;

    public static int BasePrice(TicketType ticket, DateOnly today) =>
        today <= ticket.EarlyBirdUntil ? ticket.EarlyPriceKopecks : ticket.PriceKopecks;

    public static long Quote(TicketType ticket, PromoCode? promo, DateOnly today)
    {
        long price = BasePrice(ticket, today);
        if (promo is null)
            return price;

        var discount = promo.Kind == PromoKind.Percent
            ? price * promo.Value / 100
            : promo.Value;

        return Math.Max(0, price - discount);
    }
}
