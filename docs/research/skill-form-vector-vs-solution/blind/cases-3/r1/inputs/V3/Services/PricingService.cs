using ConfReg.Data;
using ConfReg.Models;
using Microsoft.EntityFrameworkCore;

namespace ConfReg.Services;

public class PricingService
{
    private readonly ConfDbContext _db;

    public PricingService(ConfDbContext db)
    {
        _db = db;
    }

    public async Task<PromoCode?> FindPromoAsync(int conferenceId, string code, CancellationToken ct)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return await _db.PromoCodes.AsNoTracking()
            .SingleOrDefaultAsync(p => p.ConferenceId == conferenceId && p.Code == normalized, ct);
    }

    public static bool IsUsable(PromoCode promo, DateOnly today) =>
        promo.ValidUntil >= today && promo.UsedCount < promo.UsageLimit;

    public static int BasePrice(TicketType ticket, DateOnly today) =>
        today < ticket.EarlyBirdUntil ? ticket.EarlyPriceKopecks : ticket.PriceKopecks;

    public static long ApplyPromo(long price, PromoCode? promo) => promo switch
    {
        null => price,
        { Kind: PromoKind.Percent } => price - price * promo.Value / 100,
        _ => price - promo.Value,
    };
}
