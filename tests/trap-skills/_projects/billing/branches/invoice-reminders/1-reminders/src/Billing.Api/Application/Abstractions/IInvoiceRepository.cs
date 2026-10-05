using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface IInvoiceRepository
{
    Task<Invoice?> FindAsync(InvoiceId id, CancellationToken ct);
    Task<Invoice?> FindIssuedAsync(CustomerId customerId, DateOnly dueDate, CancellationToken ct);
    Task<IReadOnlyList<Invoice>> ListByStatusAsync(InvoiceStatus status, CancellationToken ct);
    Task AddAsync(Invoice invoice, CancellationToken ct);
    Task SaveAsync(Invoice invoice, CancellationToken ct);
}
