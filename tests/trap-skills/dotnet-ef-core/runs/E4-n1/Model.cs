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
    // Сложность комплектации 1..5, диапазон держит CHECK в БД (см. OnModelCreating).
    public int Complexity { get; set; }
    public DateTime CreatedAt { get; set; }          // column: timestamp without time zone, в коде всегда UTC (см. OnModelCreating)
    public DateTime? ShippedAt { get; set; }
    public bool IsDeleted { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
    public bool IsOverdue(DateTime now) => ShippedAt == null && CreatedAt.AddDays(3) < now;
}

public class OrderItem
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public int Qty { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;
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

    // Npgsql 6+ пишет Kind=Utc только в timestamptz; для naive timestamp нужен Unspecified, и одного ToUniversalTime() недостаточно - Kind надо снять явно (npgsql.org/doc/types/datetime.html).
    private static readonly ValueConverter<DateTime, DateTime> UtcAsNaiveConverter = new(
        v => DateTime.SpecifyKind(v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(), DateTimeKind.Unspecified),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>().Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(UtcAsNaiveConverter);

        b.Entity<Order>().Property(o => o.Complexity).IsRequired();
        b.Entity<Order>().ToTable(tb => tb.HasCheckConstraint(
            "CK_Order_Complexity_Range", "\"Complexity\" >= 1 AND \"Complexity\" <= 5"));

        // ClientCascade, не Cascade: у Order soft-delete, ON DELETE CASCADE в БД мог бы физически утащить Items/Payments мимо него (learn.microsoft.com/ef/core/saving/cascade-delete).
        b.Entity<Order>().HasMany(o => o.Items).WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.ClientCascade);
        b.Entity<Order>().HasMany(o => o.Payments).WithOne(p => p.Order)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.ClientCascade);

        // Фильтр Order не пересекает required navigation - повторяем его на детях, иначе Include и прямой запрос к OrderItem/Payment расходятся по числу строк (learn.microsoft.com/ef/core/querying/filters).
        b.Entity<OrderItem>().HasQueryFilter(i => !i.Order.IsDeleted);
        b.Entity<Payment>().HasQueryFilter(p => !p.Order.IsDeleted);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
