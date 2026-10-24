using Bookings.Api.Contracts;

namespace Bookings.Api.Validation;

public static class BookingRules
{
    public const int TitleMaxLength = 120;
    public const int CommentMaxLength = 500;
    public const int DurationStep = 15;
    public const int MinDurationMinutes = 15;
    public const int MaxDurationMinutes = 240;
    public const int MaxDaysAhead = 90;

    public static Dictionary<string, string[]> Validate(CreateBookingRequest request, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.RoomId))
            errors["roomId"] = ["Укажите комнату."];

        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > TitleMaxLength)
            errors["title"] = [$"Название - от 1 до {TitleMaxLength} символов."];

        if (request.Comment is { Length: > CommentMaxLength })
            errors["comment"] = [$"Комментарий - не длиннее {CommentMaxLength} символов."];

        ValidateTime(request.StartsAt, request.DurationMinutes, now, errors);
        return errors;
    }

    public static Dictionary<string, string[]> Validate(RescheduleBookingRequest request, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string[]>();
        ValidateTime(request.StartsAt, request.DurationMinutes, now, errors);
        return errors;
    }

    private static void ValidateTime(DateTimeOffset startsAt, int durationMinutes, DateTimeOffset now, Dictionary<string, string[]> errors)
    {
        if (startsAt <= now)
            errors["startsAt"] = ["Начало брони должно быть в будущем."];
        else if (startsAt > now.AddDays(MaxDaysAhead))
            errors["startsAt"] = [$"Бронировать можно не дальше чем на {MaxDaysAhead} дней вперёд."];

        if (durationMinutes < MinDurationMinutes || durationMinutes > MaxDurationMinutes || durationMinutes % DurationStep != 0)
            errors["durationMinutes"] = [$"Длительность - от {MinDurationMinutes} до {MaxDurationMinutes} минут, кратно {DurationStep}."];
    }
}
