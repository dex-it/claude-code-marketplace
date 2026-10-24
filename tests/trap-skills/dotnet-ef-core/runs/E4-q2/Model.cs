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

    /// <summary>Сложность комплектации заказа, 1 (проще всего) .. 5 (сложнее всего). Проверяется CHECK-constraint'ом в БД.</summary>
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
    // CreatedAt пишется из кода как DateTime.UtcNow, но колонка timestamp without time zone (менять нельзя,
    // на неё смотрят отчёты DBA) - Npgsql для такой колонки не хранит Kind и отдаёт значения как Unspecified.
    // Конвертер приводит запись к UTC-моменту (на случай, если кто-то напишет не-UTC DateTime) и восстанавливает
    // Kind=Utc при чтении, чтобы в коде CreatedAt всегда был предсказуемо в UTC - и при материализации, и в
    // параметрах запросов (Where(o => o.CreatedAt > ...) тоже пройдёт через конвертер).
    private static readonly ValueConverter<DateTime, DateTime> UtcDateTimeConverter = new(
        toProvider => toProvider.Kind == DateTimeKind.Utc ? toProvider : toProvider.ToUniversalTime(),
        fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);
        b.Entity<Order>().Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(UtcDateTimeConverter);

        b.Entity<Order>().Property(o => o.Complexity)
            .IsRequired()
            .HasDefaultValue(3); // безопасный дефолт для бэкафилла существующих строк; бизнес-значение задаётся явно на записи
        b.Entity<Order>().ToTable(t => t.HasCheckConstraint("CK_Order_Complexity_Range", "\"Complexity\" BETWEEN 1 AND 5"));

        // Order - Items и Order - Payments: у обоих потомков обязательный (non-nullable) FK на Order.
        // У Order есть soft-delete (HasQueryFilter выше), но у OrderItem/Payment своего фильтра нет -
        // строка Order логически исчезает, а её позиции/платежи остаются видимыми, если их не подчистить
        // приложением (см. ClearItems в OrderRepository). OnDelete(Cascade) отвечает только за физическое
        // удаление Order в БД (ON DELETE CASCADE) и не подменяет собой мягкое удаление.
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
