using System.Net;
using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Print;
using Billing.Api.Infrastructure.Reporting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Billing.Api.Application.Handlers.Invoices;

public enum PrintFormat { Html, Pdf, Xlsx }

public sealed record PrintInvoiceQuery(InvoiceId InvoiceId, PrintFormat Format, string? Title, string FileName);

public sealed record PrintedInvoice(byte[] Content, string ContentType, string FileName);

public sealed class PrintInvoiceHandler(
    IInvoiceRepository invoices,
    ReportingDbContext db,
    PdfRenderer pdf,
    IOptions<PrintOptions> options)
{
    public async Task<Result<PrintedInvoice>> HandleAsync(PrintInvoiceQuery query, CancellationToken ct)
    {
        var invoice = await invoices.FindAsync(query.InvoiceId, ct);
        if (invoice is null)
            return new InvoiceNotFoundError(query.InvoiceId);

        var row = await db.Invoices.FirstOrDefaultAsync(r => r.Id == invoice.Id.Value, ct);
        var template = File.ReadAllText(options.Value.TemplatePath);
        var html = InvoiceHtml.Render(template, new Dictionary<string, string>
        {
            ["title"] = query.Title ?? $"Счёт {invoice.Id}",
            ["logo"] = await LogoLoader.LoadBase64Async(options.Value.LogoUrl, ct),
            ["customer"] = WebUtility.HtmlEncode(row?.CustomerName ?? invoice.CustomerId.ToString()),
            ["amount"] = $"{invoice.Amount.Minor / 100m:N2} {invoice.Amount.Currency}",
            ["note"] = WebUtility.HtmlEncode(invoice.Note ?? ""),
            ["printedAt"] = DateTime.Now.ToString("dd.MM.yyyy HH:mm"),
        });

        return query.Format switch
        {
            PrintFormat.Html => new PrintedInvoice(System.Text.Encoding.UTF8.GetBytes(html), "text/html", $"{query.FileName}.html"),
            PrintFormat.Pdf => new PrintedInvoice(await pdf.RenderAsync(html, query.FileName, ct), "application/pdf", $"{query.FileName}.pdf"),
            _ => throw new NotImplementedException("xlsx"),
        };
    }
}
