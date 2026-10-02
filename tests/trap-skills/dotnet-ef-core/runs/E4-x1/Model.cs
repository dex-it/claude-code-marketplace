// Shop.Data - EF Core 8, PostgreSQL (Npgsql.EntityFrameworkCore.PostgreSQL 8)
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
    /// <summary>Сложность комплектации заказа, 1..5 (см. CK_Order_Complexity_Range).</summary>
    public int Complexity { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
    public bool IsOverdue(DateTime now) => ShippedAt == null && CreatedAt.AddDays(3) < now;
}

public class OrderItem { public int Id { get; set; } public Guid OrderId { get; set; } public Guid ProductId { get; set; } public int Qty { get; set; } }
public class Payment { public int Id { get; set; } public Guid OrderId { get; set; } public decimal Amount { get; set; } }

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

    // Column is `timestamp without time zone` and stays that way (DBA reports depend on it).
    // App code always writes DateTime.UtcNow, so on write we strip the Kind to Unspecified
    // (Npgsql requires that for a tz-less column), and on read we tag the value back as Utc,
    // per the team's Npgsql DateTime convention.
    private static readonly Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime> UtcNoTzConverter = new(
        v => DateTime.SpecifyKind(v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v, DateTimeKind.Unspecified),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>(o =>
        {
            // Soft delete: orders are never physically removed, just flagged.
            o.HasQueryFilter(x => !x.IsDeleted);

            o.Property(x => x.CreatedAt)
                .HasColumnType("timestamp without time zone")
                .HasConversion(UtcNoTzConverter);

            // Сложность комплектации: одно целое число 1..5.
            o.ToTable(t => t.HasCheckConstraint("CK_Order_Complexity_Range", "\"Complexity\" >= 1 AND \"Complexity\" <= 5"));

            // Order -> Items / Order -> Payments: required FK, but soft-deleted orders
            // are never SQL-DELETEd, so the FK itself must not cascade in the DB - dependents
            // are removed by application code (see ClearItemsAsync). ClientCascade keeps that
            // contract (DB: NO ACTION) while still letting the change tracker delete orphaned
            // dependents in memory when they're removed from the collection, so severing the
            // required relationship (e.g. Items.Clear()) does not throw.
            o.HasMany(x => x.Items)
                .WithOne()
                .HasForeignKey(i => i.OrderId)
                .IsRequired()
                .OnDelete(DeleteBehavior.ClientCascade);

            o.HasMany(x => x.Payments)
                .WithOne()
                .HasForeignKey(p => p.OrderId)
                .IsRequired()
                .OnDelete(DeleteBehavior.ClientCascade);
        });
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
