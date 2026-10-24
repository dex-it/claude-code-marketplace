namespace Notify.Api.Services;

/// <summary>
/// Ключи keyed-сервисов <see cref="INotificationSender"/>, общие для регистрации в DI
/// и для атрибутов <c>[FromKeyedServices]</c> на местах внедрения.
/// </summary>
public static class NotificationChannels
{
    public const string Email = "email";
    public const string Sms = "sms";
}
