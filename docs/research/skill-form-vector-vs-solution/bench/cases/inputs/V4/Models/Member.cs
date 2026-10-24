namespace HoneyCoop.Models;

public class Member
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";

    /// <summary>Учётная запись в личном кабинете пчеловода, если подключён.</summary>
    public string? UserId { get; set; }

    /// <summary>Расчётный счёт для выплат.</summary>
    public string BankAccount { get; set; } = "";

    /// <summary>БИК банка получателя.</summary>
    public string Bik { get; set; } = "";

    /// <summary>
    /// Непогашенный остаток выданных авансов, руб. Аванс удерживается из выплат, пока не будет погашен.
    /// </summary>
    public decimal AdvanceBalance { get; set; }
}
