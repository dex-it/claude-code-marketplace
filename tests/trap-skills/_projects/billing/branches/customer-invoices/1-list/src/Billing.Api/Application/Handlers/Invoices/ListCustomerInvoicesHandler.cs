using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ListCustomerInvoicesQuery(CustomerId CustomerId, int? Limit, string? Cursor);

public sealed record CustomerInvoiceItem(
    Guid Id,
    long AmountMinor,
    string Currency,
    DateOnly DueDate,
    InvoiceStatus Status,
    DateTimeOffset CreatedAt);

public sealed record CustomerInvoicePage(IReadOnlyList<CustomerInvoiceItem> Items, string? NextCursor);

public sealed class ListCustomerInvoicesHandler(IInvoiceRepository invoices, ListCustomerInvoicesValidator validator)
{
    private const int DefaultLimit = 20;

    public async Task<Result<CustomerInvoicePage>> HandleAsync(ListCustomerInvoicesQuery query, CancellationToken ct)
    {
        if (validator.Check(query) is { } error)
            return error;

        var limit = query.Limit ?? DefaultLimit;
        var after = query.Cursor is null ? null : InvoiceCursor.TryParse(query.Cursor);

        var found = await invoices.ListByCustomerAsync(query.CustomerId, after, limit + 1, ct);
        var pageItems = found.Take(limit).ToList();
        var nextCursor = found.Count > limit ? InvoiceCursor.From(pageItems[^1]).Encode() : null;

        var items = pageItems
            .Select(i => new CustomerInvoiceItem(
                i.Id.Value, i.Amount.Minor, i.Amount.Currency, i.DueDate, i.Status, i.CreatedAt))
            .ToList();
        return new CustomerInvoicePage(items, nextCursor);
    }
}
