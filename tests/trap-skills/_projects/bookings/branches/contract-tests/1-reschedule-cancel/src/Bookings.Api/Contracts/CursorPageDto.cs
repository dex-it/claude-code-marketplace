namespace Bookings.Api.Contracts;

public class CursorPageDto<T>
{
    public List<T>? Items { get; set; }
    public string? NextCursor { get; set; }
}
