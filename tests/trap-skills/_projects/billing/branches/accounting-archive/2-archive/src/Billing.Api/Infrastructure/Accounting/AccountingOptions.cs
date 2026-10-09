using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Accounting;

public sealed class AccountingOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";

    [Required]
    public string ArchiveDirectory { get; set; } = "";

    public string Delimiter { get; set; } = ";";
}
