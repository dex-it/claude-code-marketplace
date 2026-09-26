namespace Orders.Api.Services;

public sealed class CurrencyConverter(IServiceScopeFactory scopes)
{
    private readonly object _sync = new();
    private long _conversions;

    public long Conversions => Interlocked.Read(ref _conversions);

    public decimal Convert(decimal amount, string currency)
    {
        using var scope = scopes.CreateScope();
        var rates = scope.ServiceProvider.GetRequiredService<IRateService>();

        lock (_sync)
        {
            var rate = rates.GetRateAsync(currency).GetAwaiter().GetResult();
            _conversions++;
            return Math.Round(amount / rate, 2);
        }
    }
}
