using Billing.Api.Domain;

namespace Billing.Api.Application.Subscriptions;

public sealed class ProrationService
{
    private BillingPeriod? _period;
    private long _deltaPerPeriodMinor;

    public void Prepare(BillingPeriod period, long oldUnitPriceMinor, long newUnitPriceMinor, int quantity)
    {
        _period = period;
        _deltaPerPeriodMinor = (newUnitPriceMinor - oldUnitPriceMinor) * quantity;
    }

    public long Calculate(BillingPeriod window)
    {
        var period = _period!;
        var days = window.End.DayNumber - window.Start.DayNumber;
        return _deltaPerPeriodMinor / period.Days * days;
    }
}
