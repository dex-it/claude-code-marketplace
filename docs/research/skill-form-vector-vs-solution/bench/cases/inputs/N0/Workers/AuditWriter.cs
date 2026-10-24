namespace Shop.Data;

public class AuditWriter
{
    private readonly ShopDbContext _db;
    public AuditWriter(ShopDbContext db) => _db = db;

    public async Task WriteAsync(string text, CancellationToken ct = default)
    {
        _db.AuditLogs.Add(new AuditLog { At = DateTime.UtcNow, Text = text });
        await _db.SaveChangesAsync(ct);
    }
}
