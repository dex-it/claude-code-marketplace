using Microsoft.EntityFrameworkCore;

namespace Shop;

// EF Core 8 + Npgsql 8
public class ShopDbContext : DbContext
{
    public ShopDbContext(DbContextOptions<ShopDbContext> options) : base(options) { }

    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<BonusAccount> BonusAccounts => Set<BonusAccount>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
}
