using Microsoft.EntityFrameworkCore;

namespace Catalog.Worker.Data;

public class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<Product> Products => Set<Product>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Product>().HasKey(p => p.Sku);
        b.Entity<Product>().Property(p => p.Attributes).HasColumnType("jsonb");
    }
}

public class Product
{
    public string Sku { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public decimal Price { get; set; }
    public string Currency { get; set; } = "";
    public Dictionary<string, string>? Attributes { get; set; }
}
