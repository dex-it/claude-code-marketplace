using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Audit;

public sealed class AuditOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
