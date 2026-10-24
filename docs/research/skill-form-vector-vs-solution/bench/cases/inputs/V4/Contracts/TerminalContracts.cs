using System.ComponentModel.DataAnnotations;

namespace HoneyCoop.Contracts;

public class WeighingData
{
    [Range(1, int.MaxValue)]
    public int MemberId { get; set; }

    [Range(1, int.MaxValue)]
    public int HoneyTypeId { get; set; }

    [Range(1, int.MaxValue)]
    public int ContainerTypeId { get; set; }

    /// <summary>Сколько единиц тары стоит на весах.</summary>
    [Range(1, 20)]
    public int ContainerCount { get; set; } = 1;

    /// <summary>Вес брутто в формате весов, кг, например "41,250".</summary>
    [Required, MaxLength(16)]
    public string Gross { get; set; } = "";

    [Range(0, 100)]
    public decimal MoisturePct { get; set; }
}

public sealed class WeighingDto : WeighingData
{
    [Range(1, long.MaxValue)]
    public long WeighingNo { get; set; }

    /// <summary>Момент взвешивания с часовым поясом пункта приёмки.</summary>
    public DateTimeOffset WeighedAt { get; set; }
}

/// <summary>Исправление уже отправленного взвешивания: те же поля, что у взвешивания.</summary>
public sealed class CorrectionDto : WeighingData
{
}

public sealed record IntakeResponse(int BatchId, string Outcome, string? Grade, decimal NetKg);
