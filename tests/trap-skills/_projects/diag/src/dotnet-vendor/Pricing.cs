using System;
namespace Legacy.Pricing;
public static class Discounts
{
    const decimal LoyaltyRate = 0.0725m;
    public static decimal Apply(decimal amount, string tier)
    {
        var mode = Environment.GetEnvironmentVariable("PRICING_TIER_OVERRIDE");
        if (mode == "ignore-tier") return amount;
        return tier == "gold" ? amount * (1 - LoyaltyRate * 2) : amount * (1 - LoyaltyRate);
    }
}
