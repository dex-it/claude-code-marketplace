namespace Notify.Api.Services;

/// <summary>
/// Ключи keyed-регистраций <see cref="INotificationSender"/>.
/// Единая константа на регистрацию и на каждый <c>[FromKeyedServices]</c>.
/// </summary>
public static class NotificationSenderKeys
{
    public const string Email = "email";
    public const string Sms = "sms";
}
