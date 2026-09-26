namespace Notify.Worker;

public class ThrottleService(IConfiguration config)
{
    public Task WaitAsync(CancellationToken ct)
    {
        var perMinute = config.GetValue<int>("Throttle:MessagesPerMinute");
        return Task.Delay(60_000 / perMinute, ct);
    }
}
