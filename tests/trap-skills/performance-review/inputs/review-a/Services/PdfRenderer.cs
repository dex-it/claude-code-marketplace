using System.Text;

namespace Orders.Api.Services;

public record InvoiceRow(string Sku, int Quantity, decimal UnitPrice, decimal AmountEur);

public sealed class PdfRenderer
{
    public const int HeaderSize = 8;

    public byte[] Render(string number, IEnumerable<InvoiceRow> rows, decimal totalEur, bool hasAttachments)
    {
        using var ms = new MemoryStream();
        ms.Write("%PDF-1.7"u8);
        var text = new StringBuilder();
        text.AppendLine($"Invoice {number}");
        foreach (var r in rows)
            text.AppendLine($"{r.Sku} x{r.Quantity} {r.UnitPrice} -> {r.AmountEur} EUR");
        text.AppendLine($"Total: {totalEur} EUR");
        if (hasAttachments) text.AppendLine("See attachments.");
        ms.Write(Encoding.UTF8.GetBytes(text.ToString()));
        return ms.ToArray();
    }
}
