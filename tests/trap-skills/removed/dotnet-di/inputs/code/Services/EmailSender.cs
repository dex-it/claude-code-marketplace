namespace Notify.Api.Services;

public sealed class EmailSender : INotificationSender
{
    private readonly ILogger<EmailSender> _log;
    public EmailSender(ILogger<EmailSender> log) => _log = log;

    public Task SendAsync(string recipient, string text, CancellationToken ct = default)
    {
        _log.LogInformation("email to {Recipient}", recipient);
        return Task.CompletedTask;
    }
}
