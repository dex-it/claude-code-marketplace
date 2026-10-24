using System.ComponentModel.DataAnnotations;

namespace Bookings.Api.Domain;

public class Booking
{
    private Booking()
    {
        RoomId = null!;
        Title = null!;
        OwnerId = null!;
    }

    public Booking(string roomId, string title, string? comment, DateTimeOffset startsAt, int durationMinutes, string ownerId, DateTimeOffset createdAt)
    {
        Id = Guid.NewGuid();
        RoomId = roomId;
        Title = title;
        Comment = comment;
        OwnerId = ownerId;
        Status = BookingStatus.Active;
        CreatedAt = createdAt.ToUniversalTime();
        SetTime(startsAt, durationMinutes);
    }

    public Guid Id { get; private set; }
    public string RoomId { get; private set; }
    public string Title { get; private set; }
    public string? Comment { get; private set; }
    public DateTimeOffset StartsAt { get; private set; }
    public int DurationMinutes { get; private set; }
    public DateTimeOffset EndsAt { get; private set; }
    public string OwnerId { get; private set; }
    public BookingStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    [Timestamp]
    public uint Version { get; private set; }

    public void Reschedule(DateTimeOffset startsAt, int durationMinutes)
    {
        if (Status == BookingStatus.Cancelled)
            throw new InvalidOperationException("Отменённую бронь нельзя перенести.");

        SetTime(startsAt, durationMinutes);
    }

    public void Cancel()
    {
        if (Status == BookingStatus.Cancelled)
            throw new InvalidOperationException("Бронь уже отменена.");

        Status = BookingStatus.Cancelled;
    }

    private void SetTime(DateTimeOffset startsAt, int durationMinutes)
    {
        StartsAt = startsAt.ToUniversalTime();
        DurationMinutes = durationMinutes;
        EndsAt = StartsAt.AddHours(durationMinutes / 60);
    }
}
