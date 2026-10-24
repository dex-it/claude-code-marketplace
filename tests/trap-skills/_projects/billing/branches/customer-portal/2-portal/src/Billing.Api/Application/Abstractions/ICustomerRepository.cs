using Billing.Api.Domain;

namespace Billing.Api.Application.Abstractions;

public interface ICustomerRepository
{
    Task<Customer?> FindAsync(CustomerId id, CancellationToken ct);
    Task<Customer?> FindByEmailAsync(string email, CancellationToken ct);
    Task SaveAsync(Customer customer, CancellationToken ct);
}
