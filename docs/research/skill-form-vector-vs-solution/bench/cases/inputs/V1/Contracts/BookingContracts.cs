using System.ComponentModel.DataAnnotations;
using BerthBook.Models;
using BerthBook.Services;

namespace BerthBook.Contracts;

public sealed class CreateBookingRequest : IValidatableObject
{
    /// <summary>Сколько ночей можно забронировать онлайн; дольше - договор через диспетчера.</summary>
    public const int MaxNights = 60;

    [Range(1, int.MaxValue)]
    public int VesselId { get; set; }

    [Range(1, int.MaxValue)]
    public int BerthId { get; set; }

    public DateOnly Arrival { get; set; }
    public DateOnly Departure { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Departure <= Arrival)
            yield return new ValidationResult("Дата выезда должна быть позже даты заезда", new[] { nameof(Departure) });
        else if (Departure.DayNumber - Arrival.DayNumber > MaxNights)
            yield return new ValidationResult($"Онлайн можно забронировать не больше {MaxNights} ночей", new[] { nameof(Departure) });
    }
}

public sealed class ExtendBookingRequest
{
    public DateOnly NewDeparture { get; set; }
}

public sealed record BookingDto(
    Guid Id,
    string BerthCode,
    string VesselName,
    DateOnly Arrival,
    DateOnly Departure,
    BookingStatus Status,
    decimal Total,
    decimal Deposit,
    decimal PaidAmount);

public sealed record CreatedBookingDto(Guid Id, decimal Total, decimal Deposit, string PaymentUrl);

public sealed record CalendarSlotDto(DateOnly Arrival, DateOnly Departure, bool Confirmed, VesselDto Vessel);

public sealed record QuoteDto(int Nights, decimal Total, decimal Deposit, IReadOnlyList<NightCharge> Breakdown)
{
    public static QuoteDto From(Quote q) => new(q.Nights.Count, q.Total, q.Deposit, q.Nights);
}
