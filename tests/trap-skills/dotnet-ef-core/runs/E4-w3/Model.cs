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
    /// <summary>Сложность комплектации заказа: 1..5 (бизнес-шкала).</summary>
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

    // Колонка order.created_at остаётся "timestamp without time zone" (на неё смотрят отчёты DBA),
    // но в коде CreatedAt всегда должен быть DateTime.UtcNow. Npgsql 6+ не позволяет писать
    // Kind=Utc в "timestamp without time zone" (и не помечает Kind при чтении), поэтому конвертер:
    // - на запись требует Kind=Utc и снимает метку Kind (Unspecified) перед отправкой в БД;
    // - на чтение возвращает значение с Kind=Utc, чтобы в коде не всплыл Local/Unspecified.
    private static readonly ValueConverter<DateTime, DateTime> UtcDateTimeConverter = new(
        toProvider => toProvider.Kind == DateTimeKind.Utc
            ? DateTime.SpecifyKind(toProvider, DateTimeKind.Unspecified)
            : throw new InvalidOperationException(
                $"Order.CreatedAt должен задаваться как DateTime.UtcNow (получен Kind={toProvider.Kind})."),
        fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(UtcDateTimeConverter);

        b.Entity<Order>()
            .Property(o => o.Complexity)
            .IsRequired();

        // "Сложность комплектации" - бизнес-шкала 1..5, закреплена CHECK-констрейнтом на уровне БД.
        b.Entity<Order>().ToTable(t => t.HasCheckConstraint(
            "CK_Order_Complexity_Range",
            "\"Complexity\" BETWEEN 1 AND 5"));

        // Order помечается как удалённый (IsDeleted), а не удаляется физически.
        // Restrict вместо конвенционного Cascade: случайное физическое удаление Order
        // (в обход soft-delete) должно упасть ошибкой FK, а не молча снести Items/Payments.
        // Явное удаление позиций/платежей - через ClearItems или отдельный сценарий,
        // а не как побочный эффект удаления заказа.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(oi => oi.OrderId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Restrict);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
