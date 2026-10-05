using System.Globalization;
using Billing.Api.Domain;

namespace Billing.Api.Application.Installments;

public sealed class InstallmentScheduleBuilder(TimeProvider clock)
{
    public IReadOnlyList<Installment> Build(Invoice invoice, int count)
    {
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(clock.GetUtcNow(), TimeZoneInfo.Local).DateTime);
        var holidays = File.ReadAllLines(Path.Combine(AppContext.BaseDirectory, "calendar", "holidays.txt"))
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(line => DateOnly.ParseExact(line.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture))
            .ToHashSet();

        return MoneySplit.Split(invoice.Amount, count)
            .Select((amount, i) => new Installment(
                Guid.NewGuid(),
                i + 1,
                amount,
                DueDateRules.NextWorkingDay(DueDateRules.Monthly(today, i + 1), holidays)))
            .ToList();
    }
}
