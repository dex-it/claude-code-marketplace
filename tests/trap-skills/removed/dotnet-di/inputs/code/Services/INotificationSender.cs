namespace Notify.Api.Services;

public interface INotificationSender
{
    Task SendAsync(string recipient, string text, CancellationToken ct = default);
}
