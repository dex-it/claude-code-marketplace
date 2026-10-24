namespace Notify.Api.Services;

public interface INotificationSender
{
    Task SendAsync(string recipient, string text, CancellationToken ct = default);
}

/// <summary>
/// Ключи, под которыми реализации <see cref="INotificationSender"/>
/// зарегистрированы как keyed-сервисы .NET 8.
/// </summary>
public static class NotificationChannels
{
    public const string Email = "email";
    public const string Sms = "sms";
}
