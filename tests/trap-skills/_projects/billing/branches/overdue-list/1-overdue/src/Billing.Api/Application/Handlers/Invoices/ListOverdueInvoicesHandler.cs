using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ListOverdueInvoicesQuery(int? Page, int? PageSize);

public sealed record OverdueInvoiceItem(
    Guid Id,
    Guid CustomerId,
    long AmountMinor,
    string Currency,
    DateOnly DueDate,
    DateTimeOffset CreatedAt);

public sealed record OverdueInvoicePage(IReadOnlyList<OverdueInvoiceItem> Data, int Total);

public sealed class ListOverdueInvoicesHandler(IInvoiceRepository invoices, TimeProvider clock)
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 100;

    // Постраничная выдача: page и pageSize, в ответе data и total - как в заметке про списки счетов.
    public async Task<Result<OverdueInvoicePage>> HandleAsync(ListOverdueInvoicesQuery query, CancellationToken ct)
    {
        var page = Math.Max(query.Page ?? 1, 1);
        var pageSize = Math.Clamp(query.PageSize ?? DefaultPageSize, 1, MaxPageSize);
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

        var issued = await invoices.ListByStatusAsync(InvoiceStatus.Issued, ct);
        var overdue = issued
            .Where(i => i.DueDate < today)
            .OrderByDescending(i => i.CreatedAt)
            .ThenByDescending(i => i.Id.Value)
            .ToList();

        var items = overdue
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new OverdueInvoiceItem(
                i.Id.Value, i.CustomerId.Value, i.Amount.Minor, i.Amount.Currency, i.DueDate, i.CreatedAt))
            .ToList();
        return new OverdueInvoicePage(items, overdue.Count);
    }
}
