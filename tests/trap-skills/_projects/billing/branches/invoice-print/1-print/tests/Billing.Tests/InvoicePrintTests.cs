using Billing.Api.Infrastructure.Print;
using Xunit;

namespace Billing.Tests;

public sealed class InvoicePrintTests
{
    [Fact]
    public void Html_IsRendered()
    {
        var html = InvoiceHtml.Render(
            "<h1>{{title}}</h1><p>{{amount}}</p>",
            new Dictionary<string, string> { ["title"] = "Счёт 1", ["amount"] = "100,00 RUB" });

        Assert.NotNull(html);
    }

    [Fact(Skip = "на CI нет wkhtmltopdf")]
    public async Task Pdf_IsRendered()
    {
        var pdf = await new PdfRenderer().RenderAsync("<h1>Счёт</h1>", "test", CancellationToken.None);

        Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString(pdf, 0, 4));
    }
}
