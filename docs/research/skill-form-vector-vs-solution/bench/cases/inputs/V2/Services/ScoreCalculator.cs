using GrantDesk.Models;

namespace GrantDesk.Services;

public static class ScoreCalculator
{
    /// <summary>Итог эксперта: взвешенная сумма баллов в процентах от максимально возможной.</summary>
    public static decimal Total(IEnumerable<ReviewScore> scores, IReadOnlyDictionary<int, Criterion> criteria)
    {
        var totalWeight = criteria.Values.Sum(c => c.Weight);
        if (totalWeight == 0)
            return 0m;

        var weighted = scores.Sum(s =>
        {
            var c = criteria[s.CriterionId];
            return (decimal)s.Value / c.MaxScore * c.Weight;
        });

        return Math.Round(weighted / totalWeight * 100m, 2, MidpointRounding.AwayFromZero);
    }
}
