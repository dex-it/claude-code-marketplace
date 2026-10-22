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

public sealed class ListCustomerInvoicesHandler(IInvoiceRepository invoices)
{
    private const int DefaultLimit = 20;
    private const int MaxLimit = 100;

    public async Task<Result<CustomerInvoicePage>> HandleAsync(ListCustomerInvoicesQuery query, CancellationToken ct)
    {
        var limit = query.Limit ?? DefaultLimit;
        if (limit is < 1 or > MaxLimit)
            return new ValidationError("limit", $"must be between 1 and {MaxLimit}");

        InvoiceCursor? after = null;
        if (query.Cursor is not null)
        {
            after = InvoiceCursor.TryParse(query.Cursor);
            if (after is null)
                return new ValidationError("cursor", "invalid cursor");
        }

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
