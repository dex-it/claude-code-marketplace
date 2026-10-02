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
    public int Complexity { get; set; }              // сложность комплектации заказа, 1..5
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

    // Колонка Order.CreatedAt остаётся "timestamp without time zone" (на неё смотрят отчёты DBA),
    // но в .NET-коде она всегда должна вести себя как UTC, независимо от таймзоны клиента:
    //  - при записи любое значение нормализуется в UTC, затем Kind сбрасывается в Unspecified,
    //    т.к. сам тип колонки не хранит offset;
    //  - при чтении Kind принудительно проставляется в Utc, чтобы CreatedAt.Kind == DateTimeKind.Utc
    //    было гарантировано для всего кода, читающего сущность.
    private static readonly ValueConverter<DateTime, DateTime> UtcCreatedAtConverter = new(
        v => DateTime.SpecifyKind(v.ToUniversalTime(), DateTimeKind.Unspecified),
        v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone") // тип и имя колонки не меняются
            .HasConversion(UtcCreatedAtConverter);

        // Complexity — сложность комплектации заказа, целое число 1..5.
        b.Entity<Order>()
            .Property(o => o.Complexity)
            .IsRequired();

        b.Entity<Order>().ToTable(t => t.HasCheckConstraint(
            "CK_Order_Complexity_Range",
            "\"Complexity\" >= 1 AND \"Complexity\" <= 5"));

        // Мягкое удаление (IsDeleted) не влияет на связи в БД: Items и Payments — обязательные
        // зависимые записи заказа, поэтому явная (реальная) отвязка невозможна — при удалении
        // строки заказа (не soft-delete) они удаляются каскадно; при soft-delete (IsDeleted = true)
        // строка Order физически не удаляется, поэтому Items/Payments остаются нетронутыми.
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
