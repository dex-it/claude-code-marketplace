namespace Motorpool.Fleet.Infrastructure;

// Производственный календарь: выходные и праздничные дни (по московскому времени).
public static class WorkCalendar
{
    public static readonly TimeZoneInfo Moscow = TimeZoneInfo.FindSystemTimeZoneById("Europe/Moscow");

    private static readonly HashSet<DateOnly> Holidays = new()
    {
        new(2026, 1, 1), new(2026, 1, 2), new(2026, 1, 5), new(2026, 1, 6), new(2026, 1, 7), new(2026, 1, 8),
        new(2026, 2, 23), new(2026, 3, 9), new(2026, 5, 1), new(2026, 5, 11), new(2026, 6, 12), new(2026, 11, 4),
    };

    public static DateOnly MoscowDate(DateTime utcMoment) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utcMoment, Moscow));

    public static bool IsWorkingDay(DateTime utcMoment)
    {
        var day = MoscowDate(utcMoment);
        return day.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday) && !Holidays.Contains(day);
    }
}
