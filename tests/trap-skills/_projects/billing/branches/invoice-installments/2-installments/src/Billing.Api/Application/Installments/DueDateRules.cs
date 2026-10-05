namespace Billing.Api.Application.Installments;

internal static class DueDateRules
{
    public static DateOnly Monthly(DateOnly start, int monthOffset) => start.AddMonths(monthOffset);

    public static DateOnly NextWorkingDay(DateOnly date, IReadOnlySet<DateOnly> holidays)
    {
        while (date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday || holidays.Contains(date))
            date = date.AddDays(1);
        return date;
    }
}
