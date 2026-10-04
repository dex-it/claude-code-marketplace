namespace Billing.Api.Application.Abstractions;

public interface INotificationSender
{
    Task SendAsync(NotificationRequest request, CancellationToken ct);
}

/// <summary>
/// Письмо клиенту. Читает его сервис Mailer команды CRM - поля и их смысл согласованы с ним.
/// </summary>
public sealed record NotificationRequest(Guid CustomerId, string Subject, string Body);
