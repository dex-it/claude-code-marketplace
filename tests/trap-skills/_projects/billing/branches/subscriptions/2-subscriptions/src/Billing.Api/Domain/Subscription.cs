namespace Billing.Api.Domain;

public readonly record struct SubscriptionId(Guid Value)
{
    public static SubscriptionId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}

public enum SubscriptionStatus { Active, Suspended, Cancelled }

public sealed class Price
{
    public Price(long minor, string currency)
    {
        Minor = minor;
        Currency = currency;
    }

    public long Minor { get; set; }
    public string Currency { get; set; }
}

public sealed record BillingPeriod(DateOnly Start, DateOnly End)
{
    public int Days => End.DayNumber - Start.DayNumber + 1;

    public static BillingPeriod MonthOf(DateOnly day) => new(
        new DateOnly(day.Year, day.Month, 1),
        new DateOnly(day.Year, day.Month, DateTime.DaysInMonth(day.Year, day.Month)));
}

public sealed record UsageRecord(Guid ItemId, long Units, DateTimeOffset At);

public sealed class SubscriptionItem
{
    public required Guid Id { get; init; }
    public required string Service { get; init; }
    public required Price UnitPrice { get; init; }
    public required int Quantity { get; init; }
    public required long IncludedUnits { get; init; }
    public required Subscription Owner { get; init; }
    public long UsedUnits { get; private set; }

    public void RecordUsage(long units, DateTimeOffset at)
    {
        UsedUnits += units;
        Owner.UsageHistory.Add(new UsageRecord(Id, units, at));
        if (UsedUnits > IncludedUnits)
            Owner.Suspend("usage over included units", at);
    }
}

public sealed class Subscription
{
    public const int MaxItems = 20;

    public required SubscriptionId Id { get; init; }
    public required CustomerId CustomerId { get; init; }
    public required string Currency { get; init; }
    public required BillingPeriod CurrentPeriod { get; set; }
    public SubscriptionStatus Status { get; set; } = SubscriptionStatus.Active;
    public List<SubscriptionItem> Items { get; } = new();
    public List<UsageRecord> UsageHistory { get; } = new();
    public Invoice? LastInvoice { get; set; }
    public long ItemsTotalMinor { get; private set; }
    public DateTimeOffset? LastRenewalAttemptAt { get; set; }
    public DateTimeOffset? PriceChangedAt { get; private set; }
    public string? SuspendReason { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    public BillingError? AddItem(SubscriptionItem item, DateTimeOffset at)
    {
        if (Items.Count >= MaxItems)
            return new SubscriptionItemLimitError(Id, MaxItems);

        Items.Add(item);
        ItemsTotalMinor += item.UnitPrice.Minor * item.Quantity;
        UpdatedAt = at;
        return null;
    }

    public void PriceChanged(DateTimeOffset at)
    {
        PriceChangedAt = at;
        UpdatedAt = at;
    }

    public void Suspend(string reason, DateTimeOffset at)
    {
        Status = SubscriptionStatus.Suspended;
        SuspendReason = reason;
    }

    public bool Renew(DateOnly today)
    {
        if (Status != SubscriptionStatus.Active || today <= CurrentPeriod.End)
            return false;

        CurrentPeriod = BillingPeriod.MonthOf(today);
        return true;
    }
}

public enum RenewalRunStatus { Running, Completed, CompletedWithErrors, Failed }

public sealed class RenewalRun
{
    public required DateOnly Day { get; init; }
    public RenewalRunStatus Status { get; set; } = RenewalRunStatus.Running;
    public int Renewed { get; set; }
    public int Errors { get; set; }
}
