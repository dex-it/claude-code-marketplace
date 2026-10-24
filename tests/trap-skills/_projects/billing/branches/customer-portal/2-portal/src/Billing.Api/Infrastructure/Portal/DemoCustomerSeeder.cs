using Billing.Api.Domain;
using Billing.Api.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace Billing.Api.Infrastructure.Portal;

public sealed class DemoCustomerSeeder(InMemoryStore store, IOptions<PortalOptions> options) : IHostedService
{
    public Task StartAsync(CancellationToken ct)
    {
        var o = options.Value;
        var id = new CustomerId(Guid.Parse("00000000-0000-0000-0000-000000000001"));
        store.Customers.TryAdd(id, new Customer
        {
            Id = id,
            Email = o.DemoCustomerEmail,
            Name = "ООО Ромашка",
            PasswordHash = PasswordHasher.Hash(o.DemoCustomerPassword),
            CreditLimitMinor = 10_000_000,
            IsVerified = true,
        });
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
