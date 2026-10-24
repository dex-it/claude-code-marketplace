using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Portal;

namespace Billing.Api.Application.Handlers.Customers;

public sealed record CreateCustomerCommand(string Email, string Name, string Password, long CreditLimitMinor);

public sealed class CreateCustomerHandler(ICustomerRepository customers, CreateCustomerValidator validator)
{
    public async Task<Result<CustomerId>> HandleAsync(CreateCustomerCommand command, CancellationToken ct)
    {
        if (validator.Check(command) is { } error)
            return error;

        var customer = new Customer
        {
            Id = new CustomerId(Guid.NewGuid()),
            Email = command.Email,
            Name = command.Name,
            PasswordHash = PasswordHasher.Hash(command.Password),
            CreditLimitMinor = command.CreditLimitMinor,
        };
        await customers.SaveAsync(customer, ct);
        return customer.Id;
    }
}
