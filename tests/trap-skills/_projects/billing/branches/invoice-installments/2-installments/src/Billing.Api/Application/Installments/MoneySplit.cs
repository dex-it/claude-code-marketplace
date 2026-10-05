using Billing.Api.Domain;

namespace Billing.Api.Application.Installments;

public static class MoneySplit
{
    public static IReadOnlyList<Money> Split(Money total, int parts)
    {
        var share = total.Minor / parts;
        var remainder = total.Minor % parts;
        return Enumerable.Range(0, parts)
            .Select(i => total with { Minor = share + (i == parts - 1 ? remainder : 0) })
            .ToList();
    }
}
