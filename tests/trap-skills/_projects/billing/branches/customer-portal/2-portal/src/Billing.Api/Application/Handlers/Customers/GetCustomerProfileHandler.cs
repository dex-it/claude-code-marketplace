using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Customers;

public sealed record GetCustomerProfileQuery(CustomerId CustomerId);

public sealed class GetCustomerProfileHandler(ICustomerRepository customers)
{
    public async Task<Result<Customer>> HandleAsync(GetCustomerProfileQuery query, CancellationToken ct)
    {
        var customer = await customers.FindAsync(query.CustomerId, ct);
        return customer is null ? new CustomerNotFoundError(query.CustomerId) : customer;
    }
}
