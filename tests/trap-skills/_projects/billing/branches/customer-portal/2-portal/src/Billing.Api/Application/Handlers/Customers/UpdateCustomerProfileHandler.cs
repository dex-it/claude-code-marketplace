using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;

namespace Billing.Api.Application.Handlers.Customers;

public sealed record UpdateCustomerProfileCommand(CustomerId CurrentCustomerId, Customer Profile);

public sealed class UpdateCustomerProfileHandler(ICustomerRepository customers)
{
    public async Task<Result<CustomerId>> HandleAsync(UpdateCustomerProfileCommand command, CancellationToken ct)
    {
        var existing = await customers.FindAsync(command.CurrentCustomerId, ct);
        if (existing is null || command.Profile.Id != existing.Id)
            return new CustomerNotFoundError(command.Profile.Id);

        command.Profile.PasswordHash = existing.PasswordHash;
        await customers.SaveAsync(command.Profile, ct);
        return existing.Id;
    }
}
