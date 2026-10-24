namespace Pricing.Infrastructure.Suppliers;

public sealed class SupplierOptions
{
    public const string Section = "Suppliers";
    public Uri BaseUrl { get; set; } = new("http://localhost:5100/");
    public string ApiKey { get; set; } = "";
}
