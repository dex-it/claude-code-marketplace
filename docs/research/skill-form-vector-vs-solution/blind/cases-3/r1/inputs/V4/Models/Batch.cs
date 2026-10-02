namespace HoneyCoop.Models;

public enum HoneyGrade
{
    A = 1,
    B = 2,
}

public enum BatchStatus
{
    Accepted = 0,
    Rejected = 1,
    InPayout = 2,
    Paid = 3,
}

public class ContainerType
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    /// <summary>Масса пустой тары, кг.</summary>
    public decimal TareKg { get; set; }
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

public class Batch
{
    public int Id { get; set; }

    /// <summary>Терминал весовой, с которого пришло взвешивание.</summary>
    public string TerminalId { get; set; } = "";

    /// <summary>Порядковый номер взвешивания - счётчик терминала.</summary>
    public long WeighingNo { get; set; }

    public int MemberId { get; set; }
    public Member Member { get; set; } = null!;

    public int ContainerTypeId { get; set; }
    public ContainerType ContainerType { get; set; } = null!;

    public decimal GrossKg { get; set; }
    public decimal NetKg { get; set; }

    /// <summary>Влажность мёда, %.</summary>
    public decimal MoisturePct { get; set; }

    public HoneyGrade? Grade { get; set; }
    public BatchStatus Status { get; set; }

    /// <summary>Момент взвешивания, UTC.</summary>
    public DateTime AcceptedAt { get; set; }

    public int? PayoutId { get; set; }
    public Payout? Payout { get; set; }
}
