using BerthBook.Models;

namespace BerthBook.Services;

/// <summary>Местное время марины.</summary>
public class MarinaClock
{
    public DateOnly Today(Marina marina)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(marina.TimeZoneId);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz));
    }

    /// <summary>Переводит местные дату и время марины в UTC.</summary>
    public DateTime ToUtc(Marina marina, DateOnly date, TimeOnly localTime)
    {
        var tz = TimeZoneInfo.FindSystemTimeZoneById(marina.TimeZoneId);
        return TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(localTime, DateTimeKind.Unspecified), tz);
    }
}
