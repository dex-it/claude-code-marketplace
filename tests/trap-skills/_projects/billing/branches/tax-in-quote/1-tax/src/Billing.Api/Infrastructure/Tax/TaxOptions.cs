using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Tax;

public sealed class TaxOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
