using System.ComponentModel.DataAnnotations;
using HoneyCoop.Models;

namespace HoneyCoop.Contracts;

public sealed class CalculatePayoutRequest
{
    [Range(1, int.MaxValue)]
    public int MemberId { get; set; }

    [Range(2020, 2100)]
    public int Year { get; set; }

    [Range(1, 12)]
    public int Month { get; set; }
}

public sealed class AdjustPayoutRequest
{
    [Range(typeof(decimal), "0", "1000000")]
    public decimal Bonus { get; set; }

    [Range(typeof(decimal), "0", "1000000")]
    public decimal OtherDeductions { get; set; }

    [MaxLength(500)]
    public string? Note { get; set; }
}

public sealed class AddPriceRequest
{
    public HoneyGrade Grade { get; set; }

    [Range(typeof(decimal), "1", "100000")]
    public decimal PricePerKg { get; set; }

    public DateOnly ValidFrom { get; set; }
}

public sealed record PayoutDto(
    int Id,
    int MemberId,
    int Year,
    int Month,
    decimal GrossAmount,
    decimal Fee,
    decimal AdvanceWithheld,
    decimal Bonus,
    decimal OtherDeductions,
    decimal NetAmount,
    PayoutStatus Status,
    string CreatedBy,
    string? ApprovedBy,
    DateTime? ExportedAt);

public sealed record RegistryDto(string FileName, int Count, decimal Total);
