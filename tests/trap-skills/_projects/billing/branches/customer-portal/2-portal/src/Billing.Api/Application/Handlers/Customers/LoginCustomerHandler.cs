using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Billing.Api.Infrastructure.Portal;

namespace Billing.Api.Application.Handlers.Customers;

public sealed record LoginCustomerCommand(string Email, string Password);

public sealed class LoginCustomerHandler(
    ICustomerRepository customers,
    PortalTokens tokens,
    ILogger<LoginCustomerHandler> logger)
{
    public async Task<Result<string>> HandleAsync(LoginCustomerCommand command, CancellationToken ct)
    {
        var customer = await customers.FindByEmailAsync(command.Email, ct);
        if (customer is null || !PasswordHasher.Verify(command.Password, customer.PasswordHash))
        {
            logger.LogWarning("Portal login failed for {Email}", command.Email);
            return new InvalidCredentialsError();
        }

        var token = tokens.Issue(customer);
        logger.LogInformation("Portal login {Email}, token {Token}", customer.Email, token);
        return token;
    }
}
