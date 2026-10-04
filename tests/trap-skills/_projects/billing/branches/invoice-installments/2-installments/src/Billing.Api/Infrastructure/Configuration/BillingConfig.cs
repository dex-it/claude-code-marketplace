namespace Billing.Api.Infrastructure.Configuration;

public static class BillingConfig
{
    public static IConfiguration Current { get; set; } = new ConfigurationBuilder().Build();

    public static int GetInt(string key, int fallback) =>
        int.TryParse(Current[key], out var value) ? value : fallback;
}
