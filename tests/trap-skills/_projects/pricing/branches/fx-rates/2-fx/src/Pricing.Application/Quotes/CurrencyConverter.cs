using Pricing.Application.Abstractions;

namespace Pricing.Application.Quotes;

public sealed class CurrencyConverter(IRates rates)
{
    public async Task<decimal> ToRubAsync(decimal amount, string currency, CancellationToken ct)
    {
        if (currency == "RUB") return amount;
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                var rubPerUnit = await rates.RubPerUnitAsync(currency, ct);
                return Math.Round(amount / rubPerUnit, 2);
            }
            catch (Exception) when (attempt < 3)
            {
                await Task.Delay(500, ct);
            }
            catch (Exception)
            {
                return amount;
            }
        }
    }
}
