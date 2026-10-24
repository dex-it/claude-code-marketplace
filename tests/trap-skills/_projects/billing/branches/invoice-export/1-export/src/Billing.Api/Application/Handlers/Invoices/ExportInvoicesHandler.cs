using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ExportInvoicesQuery;

// Имена полей уходят camelCase: Minimal API сериализует с JsonSerializerDefaults.Web.
// Status уходит кодом: System.Text.Json пишет enum его числовым значением, отдельное поле-код не нужно.
public sealed record ExportedInvoice(Guid Id, long AmountMinor, string Currency, InvoiceStatus Status);

public sealed class ExportInvoicesHandler(IInvoiceRepository invoices)
{
    private static readonly InvoiceStatus[] Exported = [InvoiceStatus.Issued, InvoiceStatus.Paid, InvoiceStatus.Cancelled];

    public async Task<Result<IReadOnlyList<ExportedInvoice>>> HandleAsync(ExportInvoicesQuery query, CancellationToken ct)
    {
        var result = new List<ExportedInvoice>();
        foreach (var status in Exported)
        {
            var batch = await invoices.ListByStatusAsync(status, ct);
            result.AddRange(batch.Select(i => new ExportedInvoice(i.Id.Value, i.Amount.Minor, i.Amount.Currency, i.Status)));
        }
        return result;
    }
}
