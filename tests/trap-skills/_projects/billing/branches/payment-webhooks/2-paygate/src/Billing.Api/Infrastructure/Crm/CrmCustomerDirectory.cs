using Billing.Api.Application.Abstractions;
using Billing.Api.Domain;
using Npgsql;

namespace Billing.Api.Infrastructure.Crm;

public sealed class CrmCustomerDirectory(NpgsqlDataSource crmDb) : ICustomerDirectory
{
    public async Task<string?> FindEmailAsync(CustomerId customerId, CancellationToken ct)
    {
        await using var command = crmDb.CreateCommand(
            "select c.email from sales.customers c where c.id = $1 and c.deleted_at is null");
        command.Parameters.AddWithValue(customerId.Value);
        return await command.ExecuteScalarAsync(ct) as string;
    }
}
