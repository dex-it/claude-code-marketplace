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
    public DateTime CreatedAt { get; set; }          // column: timestamp without time zone, always UTC in code (see value converter)
    public DateTime? ShippedAt { get; set; }
    public bool IsDeleted { get; set; }

    /// <summary>"Сложность комплектации" — бизнес-шкала 1..5, диапазон закреплён CHECK-constraint'ом в БД.</summary>
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

    // Колонка "CreatedAt" остаётся timestamp without time zone (на неё смотрят отчёты DBA),
    // поэтому Kind в БД не хранится — нормализуем сами по обе стороны конвертера:
    // на запись сносим к Unspecified (UTC-значение без пометки, иначе Npgsql 6+ бросит на Kind=Utc
    // для timestamp-колонки), на чтение помечаем Utc обратно. См. skill dotnet-ef-core: "timestamp теряет Kind".
    private static readonly ValueConverter<DateTime, DateTime> CreatedAtUtcConverter = new(
        v => DateTime.SpecifyKind(v.ToUniversalTime(), DateTimeKind.Unspecified),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>().Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(CreatedAtUtcConverter);

        b.Entity<Order>().Property(o => o.Complexity).IsRequired();
        b.Entity<Order>().ToTable(t => t.HasCheckConstraint("CK_Order_Complexity_Range", "\"Complexity\" >= 1 AND \"Complexity\" <= 5"));

        // Soft-delete (IsDeleted) в Order: FK на Items/Payments — Restrict, а не Cascade,
        // чтобы случайный физический DELETE FROM "Orders" (мимо приложения, напр. скриптом DBA)
        // упал на FK-constraint, а не молча снёс дочерние записи. Явное удаление позиций
        // (см. OrderRepository.ClearItems) не зависит от этого behavior — удаляем через DbSet напрямую.
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
