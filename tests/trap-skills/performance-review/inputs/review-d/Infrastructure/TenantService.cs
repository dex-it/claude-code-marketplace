using Microsoft.EntityFrameworkCore;
using Shop.Api.Data;

namespace Shop.Api.Infrastructure;

public interface ITenantService
{
    Task<int?> ResolveAsync(string host, CancellationToken ct);
    int CurrentTenantId { get; }
}

public sealed class TenantService(ShopDbContext db) : ITenantService
{
    private int? _current;

    public int CurrentTenantId => _current ?? throw new InvalidOperationException("Tenant not resolved");

    public async Task<int?> ResolveAsync(string host, CancellationToken ct)
    {
        _current = await db.Database
            .SqlQuery<int>($"SELECT \"Id\" AS \"Value\" FROM \"Tenants\" WHERE \"Host\" = {host}")
            .Cast<int?>()
            .FirstOrDefaultAsync(ct);
        return _current;
    }
}
