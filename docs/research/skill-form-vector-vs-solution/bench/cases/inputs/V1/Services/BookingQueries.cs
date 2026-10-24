using System.Linq.Expressions;
using BerthBook.Models;

namespace BerthBook.Services;

public static class BookingQueries
{
    /// <summary>Сколько неоплаченная бронь держит место.</summary>
    public static readonly TimeSpan DepositHold = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Брони, которые занимают место: подтверждённые и неоплаченные, у которых ещё не истекло удержание.
    /// </summary>
    public static Expression<Func<Booking, bool>> Occupying(DateTime utcNow)
    {
        var holdStartedAfter = utcNow - DepositHold;
        return b => b.Status == BookingStatus.Confirmed
                    || (b.Status == BookingStatus.AwaitingDeposit && b.CreatedAt > holdStartedAfter);
    }

    /// <summary>
    /// Пересечение по ночам: в день выезда одной яхты место можно отдать следующей.
    /// </summary>
    public static Expression<Func<Booking, bool>> Overlaps(DateOnly arrival, DateOnly departure) =>
        b => b.Arrival < departure && b.Departure > arrival;
}
