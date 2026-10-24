using BerthBook.Models;

namespace BerthBook.Services;

public sealed record NightCharge(DateOnly Night, decimal RatePerMeter, decimal Amount);

public sealed record Quote(IReadOnlyList<NightCharge> Nights, decimal Total, decimal Deposit);

public class TariffCalculator
{
    public const int LongStayNights = 7;
    public const decimal LongStayDiscount = 0.10m;
    public const decimal DepositShare = 0.30m;

    // Буфер под разбивку по ночам, чтобы не аллоцировать список на каждый расчёт.
    private readonly List<NightCharge> _nights = new(capacity: 64);

    public Quote Calculate(Berth berth, Vessel vessel, DateOnly arrival, DateOnly departure)
    {
        _nights.Clear();

        var meters = Math.Ceiling(vessel.LengthM);
        for (var night = arrival; night < departure; night = night.AddDays(1))
        {
            var rate = RateFor(berth, night);
            _nights.Add(new NightCharge(night, rate, rate * meters));
        }

        var total = _nights.Sum(n => n.Amount);
        if (_nights.Count >= LongStayNights)
            total -= total * LongStayDiscount;

        total = Math.Round(total, 2, MidpointRounding.AwayFromZero);
        var deposit = Math.Round(total * DepositShare, 2, MidpointRounding.AwayFromZero);

        return new Quote(_nights.ToArray(), total, deposit);
    }

    private static decimal RateFor(Berth berth, DateOnly night) =>
        berth.SeasonalRates
            .FirstOrDefault(r => r.From <= night && night <= r.To)?.RatePerMeter
        ?? berth.BaseRatePerMeter;
}
