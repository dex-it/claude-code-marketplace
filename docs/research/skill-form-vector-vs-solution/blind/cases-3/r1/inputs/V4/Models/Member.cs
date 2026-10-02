namespace HoneyCoop.Models;

public class Member
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";

    /// <summary>Учётная запись в личном кабинете пчеловода, если подключён.</summary>
    public string? UserId { get; set; }

    public string BankAccount { get; set; } = "";

    /// <summary>Непогашенный остаток выданных авансов, руб.</summary>
    public decimal AdvanceBalance { get; set; }
}
