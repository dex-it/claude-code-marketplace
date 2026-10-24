using System.Globalization;
using System.Net;
using Billing.Api.Domain;

namespace Billing.Api.Application.Documents;

public enum DocumentFormat { Html, Pdf }

public interface IDocumentTemplate
{
    string TemplateCode => "default";
}

public interface IPdfConverter
{
    Task<byte[]> ConvertAsync(string html, CancellationToken ct);
}

public sealed record DocumentLocale(CultureInfo Culture, string DateFormat);

public static class DocumentLocales
{
    public static DocumentLocale For(string country) => country switch
    {
        "RU" => new(CultureInfo.GetCultureInfo("ru-RU"), "dd.MM.yyyy"),
        "KZ" => new(CultureInfo.GetCultureInfo("kk-KZ"), "dd.MM.yyyy"),
        _ => new(CultureInfo.GetCultureInfo("en-GB"), "dd/MM/yyyy"),
    };
}

public class InvoiceHtmlRenderer : IDocumentTemplate
{
    public virtual string RenderHtml(Invoice invoice, DocumentLocale locale, long lateFeeMinor) =>
        $"""
        <html><body>
        <h1>Invoice {invoice.Id}</h1>
        <p>Due: {invoice.DueDate.ToString(locale.DateFormat, locale.Culture)}</p>
        <p>Amount: {WebUtility.HtmlEncode(Money(invoice.Amount, locale))}</p>
        <p>Late fee: {WebUtility.HtmlEncode(Money(new Money(lateFeeMinor, invoice.Amount.Currency), locale))}</p>
        </body></html>
        """;

    public virtual async Task<byte[]> RenderPdfAsync(Invoice invoice, DocumentLocale locale, long lateFeeMinor, IPdfConverter pdf, CancellationToken ct) =>
        await pdf.ConvertAsync(RenderHtml(invoice, locale, lateFeeMinor), ct);

    protected static string Money(Money amount, DocumentLocale locale) =>
        (amount.Minor / 100m).ToString("N2", locale.Culture) + " " + amount.Currency;
}

public sealed class EuVatInvoiceRenderer : InvoiceHtmlRenderer
{
    public string TemplateCode => "eu-vat";

    public override string RenderHtml(Invoice invoice, DocumentLocale locale, long lateFeeMinor) =>
        throw new NotSupportedException("EU VAT template is rendered to PDF only");

    public override async Task<byte[]> RenderPdfAsync(Invoice invoice, DocumentLocale locale, long lateFeeMinor, IPdfConverter pdf, CancellationToken ct) =>
        await pdf.ConvertAsync(
            $"""
            <html><body>
            <h1>Invoice {invoice.Id}</h1>
            <p>Due: {invoice.DueDate.ToString(locale.DateFormat, locale.Culture)}</p>
            <p>Amount incl. VAT: {WebUtility.HtmlEncode(Money(invoice.Amount, locale))}</p>
            <p>VAT reverse charge applies where the customer is VAT-registered in another EU member state.</p>
            </body></html>
            """, ct);
}

public static class InvoiceRenderers
{
    private static readonly HashSet<string> EuCountries = ["DE", "FR", "NL", "PL", "ES", "IT"];

    public static InvoiceHtmlRenderer For(string country) => country switch
    {
        "RU" or "KZ" or "BY" => new InvoiceHtmlRenderer(),
        _ when EuCountries.Contains(country) => new EuVatInvoiceRenderer(),
        _ => new InvoiceHtmlRenderer(),
    };
}

public class DocumentPolicy
{
    public virtual BillingError? Validate(Invoice invoice) =>
        invoice.Amount.Minor > 0 ? null : new ValidationError("amount", "must be positive");
}

public sealed class KzDocumentPolicy : DocumentPolicy
{
    public override BillingError? Validate(Invoice invoice) =>
        base.Validate(invoice) ?? (invoice.Amount.Minor % 100 != 0
            ? new ValidationError("amount", "KZ documents are issued in whole tenge")
            : null);
}

public static class DocumentPolicies
{
    public static DocumentPolicy For(string country) => country == "KZ" ? new KzDocumentPolicy() : new DocumentPolicy();
}
