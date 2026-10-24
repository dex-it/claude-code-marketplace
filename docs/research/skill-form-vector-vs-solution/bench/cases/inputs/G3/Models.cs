namespace Tarif.Billing;

public enum SubscriberStatus { Lead, Active, Suspended, Closed }

public class Tariff
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal MonthlyFee { get; set; }
}

public class Subscriber
{
    public int Id { get; set; }
    public string FullName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    // Номер договора вида 12-004518. Присваивается при подписании договора монтажником,
    // у заявок на подключение (Lead) его ещё нет.
    public string? ContractNo { get; set; }
    public SubscriberStatus Status { get; set; }
    public int? TariffId { get; set; }
    public Tariff? Tariff { get; set; }
    public decimal Balance { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ConnectedAt { get; set; }

    public List<Payment> Payments { get; set; } = new();
}

public class Payment
{
    public int Id { get; set; }
    public int SubscriberId { get; set; }
    public Subscriber Subscriber { get; set; } = null!;
    public decimal Amount { get; set; }
    public string BankRef { get; set; } = "";
    public DateOnly PaidOn { get; set; }
    public DateTime CreditedAt { get; set; }
    public string Purpose { get; set; } = "";
}
