namespace HoneyCoop.Models;

public enum PayoutStatus
{
    Draft = 0,
    Approved = 1,
}

public class Payout
{
    public int Id { get; set; }

    public int MemberId { get; set; }
    public Member Member { get; set; } = null!;

    public int Year { get; set; }
    public int Month { get; set; }

    /// <summary>Сумма за принятый мёд, руб.</summary>
    public decimal GrossAmount { get; set; }

    /// <summary>Комиссия кооператива, руб.</summary>
    public decimal Fee { get; set; }

    /// <summary>Удержано в счёт аванса, руб.</summary>
    public decimal AdvanceWithheld { get; set; }

    /// <summary>Премия, начисленная вручную, руб.</summary>
    public decimal Bonus { get; set; }

    /// <summary>Прочие удержания (например, за невозвращённую тару), руб.</summary>
    public decimal OtherDeductions { get; set; }

    public string? AdjustmentNote { get; set; }

    /// <summary>К перечислению пчеловоду, руб.</summary>
    public decimal NetAmount { get; set; }

    public PayoutStatus Status { get; set; }

    /// <summary>Бухгалтер, рассчитавший выплату.</summary>
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; }

    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    /// <summary>Когда выплата попала в реестр для банка.</summary>
    public DateTime? ExportedAt { get; set; }
    public string? RegistryFile { get; set; }

    public List<Batch> Batches { get; set; } = new();

    public void RecalculateNet() =>
        NetAmount = GrossAmount - Fee - AdvanceWithheld + Bonus - OtherDeductions;
}

public class PriceListEntry
{
    public int Id { get; set; }
    public HoneyGrade Grade { get; set; }

    /// <summary>Цена закупки, руб. за кг нетто.</summary>
    public decimal PricePerKg { get; set; }

    /// <summary>Дата, с которой действует цена (до следующей записи по тому же сорту).</summary>
    public DateOnly ValidFrom { get; set; }
}

/// <summary>Журнал изменений прейскуранта для ревизионной комиссии.</summary>
public class PriceChange
{
    public int Id { get; set; }
    public int PriceListEntryId { get; set; }
    public decimal? OldPricePerKg { get; set; }
    public decimal NewPricePerKg { get; set; }
    public string ChangedBy { get; set; } = "";
    public DateTime ChangedAt { get; set; }
}
