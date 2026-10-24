using Microsoft.Extensions.Diagnostics.HealthChecks;
using Npgsql;

namespace OrdersApi.Health;

public class DbHealthCheck(IConfiguration cfg) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        await using var c = new NpgsqlConnection(cfg.GetConnectionString("Orders"));
        await c.OpenAsync();
        await using var cmd = new NpgsqlCommand("select count(*) from orders", c);
        var n = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
        return HealthCheckResult.Healthy($"orders: {n}");
    }
}
