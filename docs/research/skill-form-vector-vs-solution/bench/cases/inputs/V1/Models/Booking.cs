using System.ComponentModel.DataAnnotations;

namespace BerthBook.Models;

public enum BookingStatus
{
    AwaitingDeposit = 0,
    Confirmed = 1,
    Cancelled = 2,
}

public class Booking
{
    public Guid Id { get; set; }

    public int BerthId { get; set; }
    public Berth Berth { get; set; } = null!;

    public int VesselId { get; set; }
    public Vessel Vessel { get; set; } = null!;

    public string OwnerId { get; set; } = "";

    /// <summary>Дата заезда. Заход на место с 14:00 по местному времени марины.</summary>
    public DateOnly Arrival { get; set; }

    /// <summary>Дата выезда. Место освобождается до 12:00 по местному времени марины.</summary>
    public DateOnly Departure { get; set; }

    /// <summary>Стоимость стоянки, руб.</summary>
    public decimal Total { get; set; }

    /// <summary>Депозит к оплате, руб.</summary>
    public decimal Deposit { get; set; }

    /// <summary>Сколько клиент фактически заплатил, руб.</summary>
    public decimal PaidAmount { get; set; }

    /// <summary>Сколько возвращено клиенту, руб.</summary>
    public decimal RefundedAmount { get; set; }

    public BookingStatus Status { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? CancelledAt { get; set; }

    [Timestamp]
    public uint Version { get; set; }

    public List<Payment> Payments { get; set; } = new();

    /// <summary>Номер заказа в PayGate для этой брони.</summary>
    public string OrderRef => OrderRefPrefix + Id.ToString("N");

    public const string OrderRefPrefix = "berth-";

    public void RegisterPayment(decimal amount)
    {
        PaidAmount += amount;
        if (Status == BookingStatus.AwaitingDeposit && PaidAmount >= Deposit)
            Status = BookingStatus.Confirmed;
    }
}

public class Payment
{
    public int Id { get; set; }
    public Guid BookingId { get; set; }

    /// <summary>Идентификатор события у платёжного провайдера.</summary>
    public string ProviderEventId { get; set; } = "";

    /// <summary>Сумма платежа, руб.</summary>
    public decimal Amount { get; set; }

    public DateTime ReceivedAt { get; set; }
}
