using Bookings.Api.Domain;

namespace Bookings.Api.Contracts;

public record BookingDto(
    Guid Id,
    string RoomId,
    string Title,
    string? Comment,
    DateTimeOffset StartsAt,
    int DurationMinutes,
    DateTimeOffset EndsAt,
    string OwnerId,
    BookingStatus Status,
    uint Version)
{
    public static BookingDto From(Booking booking) => new(
        booking.Id,
        booking.RoomId,
        booking.Title,
        booking.Comment,
        booking.StartsAt,
        booking.DurationMinutes,
        booking.EndsAt,
        booking.OwnerId,
        booking.Status,
        booking.Version);
}
