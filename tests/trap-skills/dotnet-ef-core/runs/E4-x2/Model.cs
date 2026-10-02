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
        // Колонка CreatedAt остаётся "timestamp without time zone" (на неё смотрят отчёты DBA),
        // но в коде значение всегда должно быть DateTime.Kind = Utc, независимо от таймзоны клиента,
        // который писал DateTime.UtcNow. Npgsql 6+ не разрешает писать Kind=Utc в "timestamp without
        // time zone", поэтому перед записью снимаем Kind (Unspecified), а при чтении обратно
        // помечаем значение как Utc - см. dotnet-ef-core skill.
        var utcAsUnspecifiedConverter = new ValueConverter<DateTime, DateTime>(
            toProvider => DateTime.SpecifyKind(toProvider, DateTimeKind.Unspecified),
            fromProvider => DateTime.SpecifyKind(fromProvider, DateTimeKind.Utc));

        b.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

        b.Entity<Order>()
            .Property(o => o.CreatedAt)
            .HasColumnType("timestamp without time zone")
            .HasConversion(utcAsUnspecifiedConverter);

        b.Entity<Order>()
            .Property(o => o.Complexity)
            .IsRequired();

        b.Entity<Order>().ToTable(t => t.HasCheckConstraint(
            "CK_Orders_Complexity_Range",
            "\"Complexity\" BETWEEN 1 AND 5"));

        // Order -> Items и Order -> Payments: FK обязателен (OrderId не nullable), Order мягко
        // удаляется через HasQueryFilter. Чтобы разрыв required-связи (например, Order.Items.Clear())
        // не бросал исключение, а зависимые действительно удалялись кодом (а не каскадом в БД,
        // который обошёл бы soft-delete при прямом DELETE строки Order), используем
        // DeleteBehavior.ClientCascade: каскад в change tracker EF, но без ON DELETE CASCADE в БД.
        b.Entity<Order>()
            .HasMany(o => o.Items)
            .WithOne()
            .HasForeignKey(i => i.OrderId)
            .IsRequired()
            .OnDelete(DeleteBehavior.ClientCascade);

        b.Entity<Order>()
            .HasMany(o => o.Payments)
            .WithOne()
            .HasForeignKey(p => p.OrderId)
            .IsRequired()
            .OnDelete(DeleteBehavior.ClientCascade);
    }
}
// Options: UseNpgsql(cs).UseLazyLoadingProxies()
