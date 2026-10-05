using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Fx;

public sealed class FxOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
