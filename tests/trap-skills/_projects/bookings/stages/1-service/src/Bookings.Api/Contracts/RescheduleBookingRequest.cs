namespace Bookings.Api.Contracts;

public record RescheduleBookingRequest(DateTimeOffset StartsAt, int DurationMinutes, uint Version);
