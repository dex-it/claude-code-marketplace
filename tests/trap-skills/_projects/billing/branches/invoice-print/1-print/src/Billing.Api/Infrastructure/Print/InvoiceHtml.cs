namespace Billing.Api.Infrastructure.Print;

public static class InvoiceHtml
{
    public static string Render(string template, IReadOnlyDictionary<string, string> values)
    {
        var html = template;
        foreach (var (key, value) in values)
            html = html.Replace("{{" + key + "}}", value);
        return html;
    }
}
