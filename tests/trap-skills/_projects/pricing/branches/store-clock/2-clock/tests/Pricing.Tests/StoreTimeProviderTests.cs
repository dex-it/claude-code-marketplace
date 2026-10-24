using Microsoft.Extensions.Time.Testing;
using Pricing.Infrastructure.Time;

namespace Pricing.Tests;

public sealed class StoreTimeProviderTests
{
    [Fact]
    public void Local_time_is_store_time_not_server_time()
    {
        var utc = new DateTimeOffset(2026, 9, 28, 20, 30, 0, TimeSpan.Zero);
        var store = new StoreTimeProvider(new FakeTimeProvider(utc), TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow"));

        Assert.Equal(new DateTime(2026, 9, 28, 23, 30, 0), store.GetLocalNow().DateTime);
    }
}
