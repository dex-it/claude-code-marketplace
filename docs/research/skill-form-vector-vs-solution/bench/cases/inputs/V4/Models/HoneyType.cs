namespace HoneyCoop.Models;

/// <summary>Вид мёда (липовый, гречишный, вересковый и т. д.). Справочник ведёт технолог кооператива.</summary>
public class HoneyType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    /// <summary>
    /// Предельная влажность для сорта A, %, включительно. У каждого вида своя норма: например,
    /// вересковый мёд естественно более влажный, чем липовый.
    /// </summary>
    public decimal MaxMoistureGradeA { get; set; }

    /// <summary>Предельная влажность для сорта B, %, включительно. Мёд влажнее не принимается.</summary>
    public decimal MaxMoistureGradeB { get; set; }
}
