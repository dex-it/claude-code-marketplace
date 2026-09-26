// Shop.Data - EF Core 8, PostgreSQL (Npgsql.EntityFrameworkCore.PostgreSQL 8)
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Shop.Data;

public class Customer { public Guid Id { get; set; } public string Name { get; set; } = ""; public List<Order> Orders { get; set; } = new(); }

public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public virtual Customer Customer { get; set; } = null!;
    public string Status { get; set; } = "active";
    public string Category { get; set; } = "";
    public decimal Total { get; set; }
    public DateTime CreatedAt { get; set; }          // column: timestamp without time zone
    public DateTime? ShippedAt { get; set; }
    public bool IsDeleted { get; set; }
    public int Complexity { get; set; }              // сложность комплектации, 1..5
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
    public bool IsOverdue(DateTime now) => ShippedAt == null && CreatedAt.AddDays(3) < now;
}

public class OrderItem
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public Guid ProductId { get; set; }
    public int Qty { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public decimal Amount { get; set; }
}

public class Product
{
    public Guid Id { get; set; }
    public string Sku { get; set; } = "";
    public string Warehouse { get; set; } = "";
    public string Category { get; set; } = "";
    public decimal Price { get; set; }
    public int Stock { get; set; }
}

public class AuditLog { public long Id { get; set; } public DateTime At { get; set; } public string Text { get; set; } = ""; }

public class ShopDbContext : DbContext
{
    public ShopDbContext(DbContextOptions<ShopDbContext> o) : base(o) { }
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        // Npgsql rejects Kind=Utc on this store type and returns Kind=Unspecified on read; column type is fixed, so re-tag both directions here.
        var alwaysUtc = new ValueConverter<DateTime, DateTime>(
            v => v.Kind switch
            {
                DateTimeKind.Utc => DateTime.SpecifyKind(v, DateTimeKind.Unspecified),
                DateTimeKind.Local => DateTime.SpecifyKind(v.ToUniversalTime(), DateTimeKind.Unspecified),
                _ => v,
            },
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        b.Entity<Order>().Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(alwaysUtc);

        // EF Core 7+: check constraints configured on the table builder, not the entity builder directly.
        b.Entity<Order>().ToTable(t => t.HasCheckConstraint("CK_Order_Complexity", "\"Complexity\" BETWEEN 1 AND 5"));

        // Required FK: removing a child from the collection orphans it, EF deletes it on SaveChanges.
        b.Entity<OrderItem>()
            .HasOne(i => i.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        // Order's soft-delete filter isn't inherited by dependents queried directly - mirrored here.
        b.Entity<OrderItem>().HasQueryFilter(i => !i.Order!.IsDeleted);

        b.Entity<Payment>()
            .HasOne(p => p.Order)
            .WithMany(o => o.Payments)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<Payment>().HasQueryFilter(p => !p.Order!.IsDeleted);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
