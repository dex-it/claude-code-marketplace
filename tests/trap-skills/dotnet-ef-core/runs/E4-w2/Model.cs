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

    /// <summary>Сложность комплектации заказа, 1..5 (диктуется бизнесом, обеспечена CHECK-констрейнтом в БД).</summary>
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

    // Колонка Order.CreatedAt - "timestamp without time zone", менять нельзя (на неё смотрят
    // отчёты DBA). Код всегда пишет DateTime.UtcNow (Kind = Utc), а Npgsql 6+ не даёт положить
    // значение с Kind = Utc в "timestamp without time zone". Конвертер не переводит момент
    // времени - он только снимает/возвращает отметку Kind, поэтому в коде CreatedAt всегда
    // приходит с Kind = Utc, независимо от таймзоны клиента, который его туда положил.
    private static readonly ValueConverter<DateTime, DateTime> UtcNoKindConverter = new(
        toProvider => DateTime.SpecifyKind(toProvider, DateTimeKind.Unspecified),
        fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>(order =>
        {
            // Soft delete: заказы никогда не удаляются физически, только помечаются.
            order.HasQueryFilter(o => !o.IsDeleted);

            order.Property(o => o.CreatedAt)
                .HasColumnType("timestamp without time zone")
                .HasConversion(UtcNoKindConverter);

            // "Сложность комплектации": целое число 1..5, обеспечивается CHECK-констрейнтом,
            // а не только атрибутом/валидацией в коде.
            order.Property(o => o.Complexity)
                .IsRequired();

            order.ToTable(t => t.HasCheckConstraint(
                "CK_Order_Complexity_Range",
                "\"Complexity\" BETWEEN 1 AND 5"));

            // Order -> Items: позиции не имеют смысла без заказа, поэтому при физическом
            // удалении строки Order (soft-delete его не порождает) они удаляются каскадно.
            // Это же правило заставляет EF удалить orphan-строки OrderItem при
            // order.Items.Clear() (см. OrderRepository.ClearItemsAsync).
            order.HasMany(o => o.Items)
                .WithOne()
                .HasForeignKey(i => i.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            // Order -> Payments: платежи - финансовые записи, их нельзя терять молча.
            // Заказы удаляются только мягко (IsDeleted), поэтому Restrict - это
            // защита от случайного физического удаления заказа, которое стёрло бы
            // историю платежей: EF Core бросит исключение вместо тихого каскада.
            order.HasMany(o => o.Payments)
                .WithOne()
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
