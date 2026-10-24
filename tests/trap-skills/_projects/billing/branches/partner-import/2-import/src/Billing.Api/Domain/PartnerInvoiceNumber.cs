using System.Text.RegularExpressions;

namespace Billing.Api.Domain;

public sealed partial record PartnerInvoiceNumber
{
    public string Value { get; }

    public PartnerInvoiceNumber(string value)
    {
        if (!Pattern().IsMatch(value))
            throw new ArgumentException($"Invalid partner invoice number '{value}'", nameof(value));
        Value = value;
    }

    [GeneratedRegex("^[A-Za-z0-9-]{1,64}$")]
    private static partial Regex Pattern();
}
