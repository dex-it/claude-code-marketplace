using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface IInvoiceRepository
{
    Task<Invoice?> FindAsync(InvoiceId id, CancellationToken ct);
    Task<IReadOnlyList<Invoice>> ListByStatusAsync(InvoiceStatus status, CancellationToken ct);
    Task<IReadOnlyList<Invoice>> ListByCustomerAsync(CustomerId customerId, CancellationToken ct);
    Task AddAsync(Invoice invoice, CancellationToken ct);
    Task SaveAsync(Invoice invoice, CancellationToken ct);
}
