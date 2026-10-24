using Billing.Api.Domain;
using Xunit;

namespace Billing.Api.Tests;

public sealed class MoneyTests
{
    [Fact]
    public void AddSameCurrencySumsMinorUnits() =>
        Assert.Equal(new Money(350, "RUB"), new Money(100, "RUB").Add(new Money(250, "RUB")));

    [Fact]
    public void AddDifferentCurrencyThrows() =>
        Assert.Throws<InvalidOperationException>(() => new Money(100, "RUB").Add(new Money(1, "USD")));
}
