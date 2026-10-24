namespace Notify.Api.Services;

/// <summary>
/// Ключи keyed-регистраций <see cref="INotificationSender"/>.
/// Единая точка правды: используются и в Program.cs, и во всех [FromKeyedServices].
/// </summary>
public static class NotificationChannels
{
    public const string Email = "email";
    public const string Sms = "sms";
}
