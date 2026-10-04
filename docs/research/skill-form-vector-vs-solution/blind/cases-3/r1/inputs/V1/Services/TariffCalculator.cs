using BerthBook.Models;

namespace BerthBook.Services;

public sealed record Quote(int Nights, decimal Total, decimal Deposit);

public class TariffCalculator
{
    public const int LongStayNights = 7;
    public const decimal LongStayDiscount = 0.10m;
    public const decimal DepositShare = 0.30m;

    public Quote Calculate(Berth berth, Vessel vessel, DateOnly arrival, DateOnly departure)
    {
        var meters = (int)Math.Round(vessel.LengthM, MidpointRounding.AwayFromZero);
        var nights = departure.DayNumber - arrival.DayNumber;

        decimal total = 0;
        for (var night = arrival; night < departure; night = night.AddDays(1))
        {
            var rate = berth.SeasonalRates
                .FirstOrDefault(r => r.From <= night && night <= r.To)?.RatePerMeter
                ?? berth.BaseRatePerMeter;
            total += rate * meters;
        }

        if (nights >= LongStayNights)
            total -= total * LongStayDiscount;

        total = Math.Round(total, 2, MidpointRounding.AwayFromZero);
        var deposit = Math.Round(total * DepositShare, 2, MidpointRounding.AwayFromZero);

        return new Quote(nights, total, deposit);
    }
}
