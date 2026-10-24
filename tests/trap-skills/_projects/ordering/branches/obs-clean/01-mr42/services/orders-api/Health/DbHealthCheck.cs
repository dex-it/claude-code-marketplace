using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace OrdersApi.Health;

public class DbHealthCheck(IConfiguration cfg) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        await using var c = new NpgsqlConnection(cfg.GetConnectionString("Orders"));
        await c.OpenAsync(ct);
        await using var cmd = new NpgsqlCommand("select 1", c) { CommandTimeout = 2 };
        await cmd.ExecuteScalarAsync(ct);
        return HealthCheckResult.Healthy();
    }
}
