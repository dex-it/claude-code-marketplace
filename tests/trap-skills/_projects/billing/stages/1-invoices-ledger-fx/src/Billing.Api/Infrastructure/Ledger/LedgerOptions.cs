using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Ledger;

public sealed class LedgerOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";

    [Required]
    public string Account { get; set; } = "";
}
