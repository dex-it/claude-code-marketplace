using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Orders.Api.Data;
using Orders.Api.Services;

namespace Orders.Api.Controllers;

[ApiController]
public class InvoiceController(
    OrdersDbContext db,
    IRateService rates,
    CurrencyConverter converter,
    PdfRenderer pdfRenderer,
    IConfiguration config) : ControllerBase
{
    [HttpGet("api/orders/{orderId:int}/invoice")]
    public async Task<IActionResult> Invoice(int orderId)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return NotFound();

        var eurRate = rates.GetRateAsync("EUR").Result;

        IEnumerable<InvoiceRow> rows = db.OrderLines
            .Where(l => l.OrderId == orderId)
            .Select(l => new InvoiceRow(l.ProductSku, l.Quantity, l.UnitPrice, Math.Round(l.Quantity * l.UnitPrice / eurRate, 2)));

        var totalEur = rows.Sum(r => r.AmountEur);

        var attachmentsDir = Path.Combine(config["Attachments:Root"]!, orderId.ToString());
        var hasAttachments = Directory.EnumerateFiles(attachmentsDir).ToList().Count > 0;

        var pdf = pdfRenderer.Render(order.Number, rows, totalEur, hasAttachments);

        var body = new byte[pdf.Length - PdfRenderer.HeaderSize];
        Array.Copy(pdf, PdfRenderer.HeaderSize, body, 0, body.Length);
        var checksum = await Task.Run(() => Checksum.Compute(body));

        Response.Headers["X-Invoice-Checksum"] = checksum.ToString("x8");
        return File(pdf, "application/pdf", $"invoice-{order.Number}.pdf");
    }

    [HttpGet("api/orders/{orderId:int}/total-in")]
    public async Task<ActionResult<decimal>> TotalIn(int orderId, string currency)
    {
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order is null) return NotFound();
        return converter.Convert(order.Total, currency);
    }
}
