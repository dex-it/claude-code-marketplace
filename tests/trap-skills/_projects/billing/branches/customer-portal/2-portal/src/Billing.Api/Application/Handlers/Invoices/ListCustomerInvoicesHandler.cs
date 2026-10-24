using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Invoices;

public sealed record ListCustomerInvoicesQuery(CustomerId CustomerId);

public sealed record CustomerInvoiceItem(Guid Id, long AmountMinor, string Currency, DateOnly DueDate, InvoiceStatus Status);

public sealed class ListCustomerInvoicesHandler(IInvoiceRepository invoices)
{
    public async Task<IReadOnlyList<CustomerInvoiceItem>> HandleAsync(ListCustomerInvoicesQuery query, CancellationToken ct)
    {
        var list = await invoices.ListByCustomerAsync(query.CustomerId, ct);
        return list
            .Select(i => new CustomerInvoiceItem(i.Id.Value, i.Amount.Minor, i.Amount.Currency, i.DueDate, i.Status))
            .ToList();
    }
}
