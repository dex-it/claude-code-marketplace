using System.Globalization;
using System.Text;
using Billing.Api.Domain;
using Microsoft.AspNetCore.WebUtilities;

namespace Billing.Api.Application.Abstractions;

public sealed record InvoiceCursor(DateTimeOffset CreatedAt, InvoiceId InvoiceId)
{
    public static InvoiceCursor From(Invoice invoice) => new(invoice.CreatedAt, invoice.Id);

    public string Encode() =>
        Base64UrlTextEncoder.Encode(Encoding.UTF8.GetBytes($"{CreatedAt.ToString("O", CultureInfo.InvariantCulture)}|{InvoiceId}"));

    public static InvoiceCursor? TryParse(string value)
    {
        try
        {
            var parts = Encoding.UTF8.GetString(Base64UrlTextEncoder.Decode(value)).Split('|');
            if (parts.Length == 2
                && DateTimeOffset.TryParseExact(parts[0], "O", CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var createdAt)
                && Guid.TryParse(parts[1], out var id))
                return new InvoiceCursor(createdAt, new InvoiceId(id));
            return null;
        }
        catch (FormatException)
        {
            return null;
        }
    }
}
