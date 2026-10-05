using Billing.Api.Application.Handlers.Invoices;
using Billing.Api.Application.Installments;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Configuration;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Billing.Tests;

public sealed class InstallmentScheduleTests
{
    private static Invoice IssuedInvoice(long minor)
    {
        var invoice = new Invoice
        {
            Id = InvoiceId.New(),
            CustomerId = new CustomerId(Guid.NewGuid()),
            Amount = new Money(minor, "RUB"),
            DueDate = new DateOnly(2027, 1, 31),
            CreatedAt = DateTimeOffset.UnixEpoch,
        };
        invoice.Issue();
        return invoice;
    }

    [Fact]
    public void Split_RemainderGoesToOnePayment()
    {
        var parts = MoneySplit.Split(new Money(1000, "RUB"), 3);

        Assert.Equal(new long[] { 333, 333, 334 }, parts.Select(p => p.Minor));
    }

    [Fact]
    public void Build_MonthEnd_ClampsToLastDayAndSkipsWeekend()
    {
        var builder = new InstallmentScheduleBuilder(new FixedClock(new DateTimeOffset(2027, 1, 30, 21, 30, 0, TimeSpan.Zero)));

        var schedule = builder.Build(IssuedInvoice(90000), 3);

        Assert.Equal(
            new[] { new DateOnly(2027, 3, 1), new DateOnly(2027, 3, 31), new DateOnly(2027, 4, 30) },
            schedule.Select(i => i.DueDate));
        Assert.Equal(new[] { 1, 2, 3 }, schedule.Select(i => i.Number));
    }

    [Fact]
    public void Validator_RespectsConfiguredMaxCount()
    {
        BillingConfig.Current = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Installments:MaxCount"] = "4" })
            .Build();

        var validator = new ScheduleInstallmentsValidator();

        Assert.Null(validator.Check(new ScheduleInstallmentsCommand(InvoiceId.New(), 4)));
        Assert.NotNull(validator.Check(new ScheduleInstallmentsCommand(InvoiceId.New(), 5)));
    }

    [Fact(Skip = "выборочный контроль случайный и шлёт письмо - проверяется на стенде")]
    public void Sampler_SendsShareOfSchedules()
    {
    }
}
