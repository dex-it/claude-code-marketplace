using Billing.Api.Domain;

namespace Billing.Api.Application.Fx;

public static class MoneyConversion
{
    public static Money ConvertTo(this Money money, string currency, decimal rate) =>
        new((long)Math.Round(money.Minor * rate, MidpointRounding.ToEven), currency);
}
