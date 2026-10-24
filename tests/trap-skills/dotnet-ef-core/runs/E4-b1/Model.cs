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
    /// <summary>Сложность комплектации заказа, 1..5 (бизнес-шкала).</summary>
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

        // CreatedAt: колонка остаётся "timestamp without time zone" (её видят отчёты DBA),
        // но в C#-коде значение всегда должно быть DateTimeKind.Utc.
        // Npgsql 8 не разрешает писать в "timestamp without time zone" значение с Kind=Utc
        // (кидает исключение), поэтому на пути "в БД" Kind сбрасывается в Unspecified
        // (сам момент времени не меняется, трактуем его как UTC), а на пути "из БД"
        // Kind принудительно проставляется в Utc.
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            toProvider => DateTime.SpecifyKind(toProvider, DateTimeKind.Unspecified),
            fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(utcConverter);

        // Order.Complexity - сложность комплектации, 1..5.
        b.Entity<Order>()
            .Property(o => o.Complexity)
            .IsRequired();
        b.Entity<Order>()
            .ToTable(t => t.HasCheckConstraint("CK_Order_Complexity_Range", "\"Complexity\" BETWEEN 1 AND 5"));

        // Order -> Items / Order -> Payments: явные связи "один ко многим".
        // Мягкое удаление (IsDeleted) не запускает физический DELETE на Order,
        // поэтому каскад тут описывает поведение при обычном удалении строки
        // Order из БД (например, служебная очистка), а не поведение soft-delete.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
