namespace ConfReg.Models;

public enum RegistrationStatus
{
    PendingPayment = 0,
    Paid = 1,
    Cancelled = 2,
}

public class Registration
{
    public int Id { get; set; }

    public int ConferenceId { get; set; }
    public Conference Conference { get; set; } = null!;

    public int TicketTypeId { get; set; }
    public TicketType TicketType { get; set; } = null!;

    public string UserId { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";

    /// <summary>Организация, от которой едет участник (claim "org_id"), если есть.</summary>
    public string? OrganizationId { get; set; }

    public int? PromoCodeId { get; set; }

    /// <summary>Цена, по которой оформлен билет (с учётом раннего тарифа и промокода), коп.</summary>
    public long PriceKopecks { get; set; }

    /// <summary>Сумма к возврату участнику после отмены, коп.</summary>
    public long RefundedKopecks { get; set; }

    public RegistrationStatus Status { get; set; }

    /// <summary>Паспортные данные иностранного участника для визового приглашения.</summary>
    public string? PassportNumber { get; set; }
    public string? PassportCountry { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
}

public class GroupOrder
{
    public int Id { get; set; }
    public int ConferenceId { get; set; }
    public string OrganizationId { get; set; } = "";
    public int TicketTypeId { get; set; }
    public int Quantity { get; set; }

    /// <summary>Сумма счёта, коп.</summary>
    public long AmountKopecks { get; set; }

    public string CreatedBy { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
