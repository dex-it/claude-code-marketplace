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

    /// <summary>К перечислению пчеловоду, руб.</summary>
    public decimal NetAmount { get; set; }

    public PayoutStatus Status { get; set; }

    /// <summary>Бухгалтер, рассчитавший выплату.</summary>
    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; }

    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public List<Batch> Batches { get; set; } = new();
}
