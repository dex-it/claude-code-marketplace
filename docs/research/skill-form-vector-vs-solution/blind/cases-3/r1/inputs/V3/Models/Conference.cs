namespace ConfReg.Models;

public class Conference
{
    public int Id { get; set; }
    public string Title { get; set; } = "";

    /// <summary>Первый день конференции.</summary>
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public List<TicketType> TicketTypes { get; set; } = new();
}

public class TicketType
{
    public int Id { get; set; }
    public int ConferenceId { get; set; }
    public string Name { get; set; } = "";

    /// <summary>Полная цена билета, коп.</summary>
    public int PriceKopecks { get; set; }

    /// <summary>Цена по раннему тарифу, коп.</summary>
    public int EarlyPriceKopecks { get; set; }

    /// <summary>Последний день действия раннего тарифа.</summary>
    public DateOnly EarlyBirdUntil { get; set; }
}

public enum PromoKind
{
    Percent = 0,
    Fixed = 1,
}

public class PromoCode
{
    public int Id { get; set; }
    public int ConferenceId { get; set; }

    /// <summary>Код промокода, хранится в верхнем регистре.</summary>
    public string Code { get; set; } = "";

    public PromoKind Kind { get; set; }

    /// <summary>Для Percent - процент скидки (1–100), для Fixed - сумма скидки, коп.</summary>
    public int Value { get; set; }

    public int UsageLimit { get; set; }
    public int UsedCount { get; set; }

    /// <summary>Последний день действия промокода.</summary>
    public DateOnly ValidUntil { get; set; }
}
