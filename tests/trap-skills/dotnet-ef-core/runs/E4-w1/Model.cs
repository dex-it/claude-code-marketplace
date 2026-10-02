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
    /// <summary>Сложность комплектации заказа, шкала 1..5 (см. CK_Order_Complexity_Range).</summary>
    public int Complexity { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public List<Payment> Payments { get; set; } = new();
    public bool IsOverdue(DateTime now) => ShippedAt == null && CreatedAt.AddDays(3) < now;
}

public class OrderItem
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public virtual Order Order { get; set; } = null!;
    public Guid ProductId { get; set; }
    public int Qty { get; set; }
}

public class Payment
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public virtual Order Order { get; set; } = null!;
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
        // Soft delete: удалённые заказы не должны попадать в обычные выборки.
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        // CreatedAt пишется из кода как DateTime.UtcNow, но колонку менять нельзя -
        // это "timestamp without time zone", на неё смотрят отчёты DBA. Такая колонка не хранит
        // информацию о зоне, и Npgsql отдаёт значение с Kind=Unspecified. Конвертер приводит
        // Kind к Utc в обе стороны, чтобы в коде CreatedAt всегда был UTC независимо от таймзоны
        // клиента, при этом на диске ничего не меняется.
        var utcNoTzConverter = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(utcNoTzConverter);

        // Complexity - "сложность комплектации", целое число 1..5.
        b.Entity<Order>()
            .ToTable(t => t.HasCheckConstraint("CK_Order_Complexity_Range", "\"Complexity\" BETWEEN 1 AND 5"));

        // Order -> Items / Order -> Payments: связи задаём явно.
        // OnDelete(Restrict), а не Cascade по умолчанию для required-связи: у Order удаление
        // мягкое (IsDeleted), физическая строка Order никогда не должна удаляться приложением;
        // Restrict защищает от случая, если это всё же произойдёт (ручной SQL, скрипт очистки) -
        // тогда позиции и платежи не улетят каскадом молча, а упадёт ошибка FK.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne(p => p.Order)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        // Тот же фильтр soft-delete должен действовать и при выборках напрямую по OrderItem/Payment,
        // иначе позиции и платежи удалённого заказа продолжат "утекать" в отчёты и запросы.
        b.Entity<OrderItem>().HasQueryFilter(i => !i.Order.IsDeleted);
        b.Entity<Payment>().HasQueryFilter(p => !p.Order.IsDeleted);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
