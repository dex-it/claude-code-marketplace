namespace Pricing.Infrastructure.Suppliers;

public sealed class SupplierCacheOptions
{
    public const string Section = "SupplierCache";
    public TimeSpan Ttl { get; set; } = TimeSpan.FromMinutes(10);
    public TimeSpan NotFoundTtl { get; set; } = TimeSpan.FromSeconds(30);
}
