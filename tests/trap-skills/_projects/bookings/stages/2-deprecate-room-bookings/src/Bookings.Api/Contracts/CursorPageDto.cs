namespace Bookings.Api.Contracts;

public record CursorPageDto<T>(IReadOnlyList<T> Items, string? NextCursor);
