namespace Bookings.Api.Contracts;

public record CreateBookingRequest(string RoomId, string Title, DateTimeOffset StartsAt, int DurationMinutes, string? Comment);
