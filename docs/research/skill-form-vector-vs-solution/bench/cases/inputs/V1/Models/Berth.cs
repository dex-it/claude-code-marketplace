namespace BerthBook.Models;

public class Marina
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    /// <summary>IANA-идентификатор часового пояса марины, например "Europe/Moscow".</summary>
    public string TimeZoneId { get; set; } = "Europe/Moscow";

    public List<Berth> Berths { get; set; } = new();
}

public class Berth
{
    public int Id { get; set; }
    public int MarinaId { get; set; }
    public Marina Marina { get; set; } = null!;

    /// <summary>Номер места на понтоне, например "B-14".</summary>
    public string Code { get; set; } = "";

    /// <summary>Наибольшая длина судна для этого места, м.</summary>
    public decimal MaxLengthM { get; set; }

    /// <summary>Ширина места между соседними пальцами понтона, м.</summary>
    public decimal MaxBeamM { get; set; }

    /// <summary>Базовая ставка, руб. за метр длины судна в сутки.</summary>
    public decimal BaseRatePerMeter { get; set; }

    public List<SeasonalRate> SeasonalRates { get; set; } = new();
}

public class SeasonalRate
{
    public int Id { get; set; }
    public int BerthId { get; set; }

    public DateOnly From { get; set; }

    /// <summary>Последний день сезона (включительно).</summary>
    public DateOnly To { get; set; }

    /// <summary>Ставка сезона, руб. за метр длины судна в сутки.</summary>
    public decimal RatePerMeter { get; set; }
}
