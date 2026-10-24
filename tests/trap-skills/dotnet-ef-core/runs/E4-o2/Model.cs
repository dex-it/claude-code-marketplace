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
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        // Колонка остаётся "timestamp without time zone" (на неё смотрят отчёты DBA — тип не трогаем).
        // В коде пишем/читаем DateTime.UtcNow (Kind=Utc), но Npgsql 6+ не даёт записать Kind=Utc
        // в timestamp without time zone. Поэтому на запись гасим Kind до Unspecified (значение уже
        // приведено к UTC через ToUniversalTime()), а на чтение помечаем Kind=Utc обратно —
        // без сдвига значения. В итоге в приложении CreatedAt всегда UTC, независимо от таймзоны клиента.
        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(
                v => DateTime.SpecifyKind(v.ToUniversalTime(), DateTimeKind.Unspecified),
                v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        b.Entity<Order>()
            .Property(o => o.Complexity)
            .IsRequired();

        // Сложность комплектации — целое 1..5; ограничение диапазона на уровне БД.
        b.Entity<Order>().ToTable(t => t.HasCheckConstraint(
            "CK_Order_Complexity_Range",
            "\"Complexity\" BETWEEN 1 AND 5"));

        // Order — soft-delete (IsDeleted), поэтому cascade delete на детях намеренно НЕ используем:
        // физический DELETE FROM "Orders" (в обход soft-delete) не должен молча снести Items/Payments.
        // Явное удаление позиций делаем через ClearItemsAsync (RemoveRange), а не через Order.Delete.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
