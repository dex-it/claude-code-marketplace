namespace Pricing.Infrastructure.Time;

/// <summary>Часы с поясом магазина вместо пояса сервера.</summary>
public sealed class StoreTimeProvider(TimeProvider inner, TimeZoneInfo storeZone) : TimeProvider
{
    public override TimeZoneInfo LocalTimeZone => storeZone;

    public override DateTimeOffset GetUtcNow() => inner.GetUtcNow();

    public override long GetTimestamp() => inner.GetTimestamp();

    public override long TimestampFrequency => inner.TimestampFrequency;

    public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period) =>
        inner.CreateTimer(callback, state, dueTime, period);
}
