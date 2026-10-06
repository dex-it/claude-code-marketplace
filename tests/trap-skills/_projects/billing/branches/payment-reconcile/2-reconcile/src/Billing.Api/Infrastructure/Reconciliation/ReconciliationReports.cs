using System.Collections.Concurrent;

namespace Billing.Api.Infrastructure.Reconciliation;

public sealed class ReconciliationReports
{
    public ConcurrentDictionary<DateOnly, IReadOnlyList<string>> ByDay { get; } = new();
}
