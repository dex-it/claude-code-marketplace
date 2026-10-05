namespace Billing.Api.Domain;

public readonly record struct Money(long Minor, string Currency)
{
    public Money Add(Money other) => this with { Minor = Minor + Same(other).Minor };

    public Money Subtract(Money other) => this with { Minor = Minor - Same(other).Minor };

    private Money Same(Money other) => other.Currency == Currency
        ? other
        : throw new InvalidOperationException($"Currency mismatch: {Currency} vs {other.Currency}");
}
