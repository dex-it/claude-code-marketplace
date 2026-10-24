using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Infrastructure.Persistence;

public sealed class InMemoryCustomerRepository(InMemoryStore store) : ICustomerRepository
{
    public Task<Customer?> FindAsync(CustomerId id, CancellationToken ct) =>
        Task.FromResult(store.Customers.GetValueOrDefault(id));

    public Task<Customer?> FindByEmailAsync(string email, CancellationToken ct) =>
        Task.FromResult(store.Customers.Values.FirstOrDefault(
            c => string.Equals(c.Email, email, StringComparison.OrdinalIgnoreCase)));

    public Task SaveAsync(Customer customer, CancellationToken ct)
    {
        store.Customers[customer.Id] = customer;
        return Task.CompletedTask;
    }
}
