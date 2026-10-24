namespace Billing.Api.Infrastructure.Portal;

public sealed class PortalOptions
{
    public string Issuer { get; set; } = "billing";
    public string Audience { get; set; } = "billing-portal";
    public string SigningKey { get; set; } = "b1ll1ng-p0rtal-s1gn1ng-key-2026-k33p-1t-s3cr3t";
    public TimeSpan TokenLifetime { get; set; } = TimeSpan.FromHours(1);
    public string DemoCustomerEmail { get; set; } = "demo@romashka.ru";
    public string DemoCustomerPassword { get; set; } = "Romashka2026";
}
