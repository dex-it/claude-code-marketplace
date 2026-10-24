namespace Bookings.Api.Contracts;

public record PageDto<T>(IReadOnlyList<T> Items, int Total);
