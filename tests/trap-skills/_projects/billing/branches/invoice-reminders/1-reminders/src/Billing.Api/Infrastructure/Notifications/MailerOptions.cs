using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Notifications;

public sealed class MailerOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
