using System.ComponentModel.DataAnnotations;

namespace Billing.Api.Infrastructure.Bank;

public sealed class BankOptions
{
    [Required, Url]
    public string BaseUrl { get; set; } = "";
}
