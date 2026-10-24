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

        if (!IsValidTitle(request.Title))
            errors["title"] = [$"Название - от 1 до {TitleMaxLength} символов."];

        if (!IsValidComment(request.Comment))
            errors["comment"] = [$"Комментарий - не длиннее {CommentMaxLength} символов."];

        AddTimeErrors(request.StartsAt, request.DurationMinutes, now, errors);
        return errors;
    }

    public static Dictionary<string, string[]> Validate(RescheduleBookingRequest request, DateTimeOffset now)
    {
        var errors = new Dictionary<string, string[]>();
        AddTimeErrors(request.StartsAt, request.DurationMinutes, now, errors);
        return errors;
    }

    public static bool IsValidTitle(string? title) =>
        !string.IsNullOrWhiteSpace(title) && title.Length <= TitleMaxLength;

    public static bool IsValidComment(string? comment) =>
        comment is null || comment.Length <= CommentMaxLength;

    public static bool IsValidDuration(int durationMinutes) =>
        durationMinutes >= MinDurationMinutes
        && durationMinutes < MaxDurationMinutes
        && durationMinutes % DurationStep == 0;

    public static bool IsInBookingWindow(DateTimeOffset startsAt, DateTimeOffset now) =>
        startsAt > now && startsAt <= now.AddDays(MaxDaysAhead);

    private static void AddTimeErrors(DateTimeOffset startsAt, int durationMinutes, DateTimeOffset now, Dictionary<string, string[]> errors)
    {
        if (!IsInBookingWindow(startsAt, now))
            errors["startsAt"] = startsAt <= now
                ? ["Начало брони должно быть в будущем."]
                : [$"Бронировать можно не дальше чем на {MaxDaysAhead} дней вперёд."];

        if (!IsValidDuration(durationMinutes))
            errors["durationMinutes"] = [$"Длительность - от {MinDurationMinutes} до {MaxDurationMinutes} минут, кратно {DurationStep}."];
    }
}
