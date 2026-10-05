using Billing.Api.Application.Abstractions;

namespace Billing.Api.Application.Handlers.CreditNotes;

public sealed record CreditNotesDashboardQuery(int Year, int Month);

public sealed record CustomerCreditSummary(Guid CustomerId, int Count, long TotalMinor);

public sealed class CreditNotesDashboardHandler(ICreditNoteRepository notes)
{
    public async Task<IReadOnlyList<CustomerCreditSummary>> HandleAsync(CreditNotesDashboardQuery query, CancellationToken ct)
    {
        var issued = await notes.ListIssuedAsync(ct);
        return issued
            .Where(n => n.IssuedAt!.Value.Month == query.Month)
            .GroupBy(n => n.CustomerId)
            .Select(g => new CustomerCreditSummary(g.Key, g.Count(), g.Sum(n => n.TotalMinor)))
            .OrderByDescending(s => s.TotalMinor)
            .ToList();
    }
}
