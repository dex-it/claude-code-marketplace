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
    public DateTime CreatedAt { get; set; }          // column: timestamp without time zone, значение всегда UTC
    public DateTime? ShippedAt { get; set; }
    public bool IsDeleted { get; set; }
    /// <summary>Сложность комплектации заказа, шкала бизнеса: 1 (просто) .. 5 (максимально сложно).</summary>
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

    // Order.CreatedAt - колонка "timestamp without time zone" (менять тип нельзя, на неё смотрят отчёты DBA).
    // Начиная с Npgsql 6 запись DateTime с Kind=Utc в такую колонку падает с исключением, поэтому конвертер
    // снимает Kind перед записью и восстанавливает Kind=Utc при чтении. Контракт: в коде CreatedAt - всегда
    // DateTime.UtcNow / значение с Kind=Utc, независимо от таймзоны клиента; в колонке лежит "голый" UTC-момент.
    private static readonly ValueConverter<DateTime, DateTime> UtcNoTzConverter = new(
        toProvider => DateTime.SpecifyKind(
            toProvider.Kind == DateTimeKind.Utc ? toProvider : toProvider.ToUniversalTime(),
            DateTimeKind.Unspecified),
        fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone") // тип колонки не меняем
            .HasConversion(UtcNoTzConverter);

        // Сложность комплектации: 1..5, задаёт бизнес. Диапазон закрепляем check-constraint'ом в БД.
        b.Entity<Order>().Property(o => o.Complexity).IsRequired();
        b.Entity<Order>().ToTable(t => t.HasCheckConstraint(
            "CK_Order_Complexity_Range", "\"Complexity\" >= 1 AND \"Complexity\" <= 5"));

        // Order удаляется мягко (IsDeleted + HasQueryFilter выше), поэтому не полагаемся на каскад в БД:
        // реальный DELETE у Order штатно не происходит, а если случится в обход soft-delete (ручная миграция,
        // скрипт DBA), позиции и платежи не должны молча исчезать вместе с ним - только через явный код.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(oi => oi.OrderId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
