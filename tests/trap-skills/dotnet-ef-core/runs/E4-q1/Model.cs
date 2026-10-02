// Shop.Data - EF Core 8, PostgreSQL (Npgsql.EntityFrameworkCore.PostgreSQL 8)
using Microsoft.EntityFrameworkCore;
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
    /// <summary>Сложность комплектации заказа, шкала 1..5 (бизнес-термин Complexity).</summary>
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

    // CreatedAt пишется в коде только как DateTime.UtcNow (Kind=Utc), а колонка остаётся
    // "timestamp without time zone" (менять её нельзя - на неё смотрят отчёты DBA).
    // Npgsql 6+ пишет в такую колонку только Kind=Unspecified, поэтому на границе меняем Kind
    // туда-обратно: в БД уходит Unspecified (значение то же самое, это всегда UTC по контракту),
    // а из БД/в параметрах запросов оно всегда возвращается как Kind=Utc, что и защищает от
    // расхождений часовых поясов клиентов.
    private static readonly ValueConverter<DateTime, DateTime> UtcCreatedAtConverter = new(
        toProvider => DateTime.SpecifyKind(
            toProvider.Kind == DateTimeKind.Utc ? toProvider : toProvider.ToUniversalTime(),
            DateTimeKind.Unspecified),
        fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(UtcCreatedAtConverter);

        b.Entity<Order>()
            .Property(o => o.Complexity)
            .IsRequired();

        // "Сложность комплектации" - целое 1..5; ограничиваем диапазон на уровне БД.
        b.Entity<Order>()
            .ToTable(t => t.HasCheckConstraint("CK_Order_Complexity_Range", "\"Complexity\" >= 1 AND \"Complexity\" <= 5"));

        // Order - required FK у OrderItem/Payment (OrderId не nullable). Order мягко удаляется
        // (HasQueryFilter), поэтому реального DELETE заказа обычно не происходит - но если он всё
        // же случится (например, чистка старых soft-deleted строк), в БД должен быть каскад, чтобы
        // не упереться в FK-констрейнт. OnDelete настраиваем явно для обеих связей.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Cascade);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
