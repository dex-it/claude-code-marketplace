namespace Notify.Api.Services;

public sealed class SmsSender : INotificationSender
{
    private readonly ILogger<SmsSender> _log;
    public SmsSender(ILogger<SmsSender> log) => _log = log;

    public Task SendAsync(string recipient, string text, CancellationToken ct = default)
    {
        _log.LogInformation("sms to {Recipient}", recipient);
        return Task.CompletedTask;
    }
}
