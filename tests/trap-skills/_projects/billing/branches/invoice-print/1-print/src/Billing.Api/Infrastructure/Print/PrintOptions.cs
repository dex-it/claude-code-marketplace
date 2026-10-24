namespace Billing.Api.Infrastructure.Print;

public sealed class PrintOptions
{
    public string LogoUrl { get; set; } = "";
    public string TemplatePath { get; set; } = "templates/invoice.html";
}
